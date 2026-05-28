import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import React, { useEffect, useRef } from "react";
import { Platform, AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

SplashScreen.preventAutoHideAsync();

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient();

// True when running inside Expo Go (not a standalone/dev build)
const isExpoGo = Constants.appOwnership === "expo";

async function scheduleLocalMaintenanceNotifications(
  tasks: Array<{ id: string; title: string; assetName: string; nextDueDate: string }>
) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  for (const task of tasks) {
    const dueDate = new Date(`${task.nextDueDate}T08:00:00`);

    // 3-day advance reminder
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    if (reminderDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Maintenance Reminder",
          body: `"${task.title}" on your ${task.assetName} is due in 3 days.`,
          data: { taskId: task.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });
    }

    // On-the-day reminder
    if (dueDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Maintenance Due Today",
          body: `"${task.title}" on your ${task.assetName} is due today.`,
          data: { taskId: task.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dueDate,
        },
      });
    }
  }
}

async function syncNotifications(getToken: () => Promise<string | null>) {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const authToken = await getToken();
  if (!authToken) return;

  if (isExpoGo) {
    // Remote push not supported in Expo Go SDK 53+ — use local scheduled notifications instead
    try {
      const res = await fetch(`${base}/api/maintenance/upcoming`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const { tasks } = await res.json();
        await scheduleLocalMaintenanceNotifications(tasks);
      }
    } catch {
      // Best-effort — never crash
    }
    return;
  }

  // Production / dev-build: register Expo push token for server-side delivery
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await fetch(`${base}/api/push-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: tokenData.data, platform: Platform.OS }),
    });

    // Also schedule local fallbacks
    const res = await fetch(`${base}/api/maintenance/upcoming`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const { tasks } = await res.json();
      await scheduleLocalMaintenanceNotifications(tasks);
    }
  } catch {
    // Best-effort
  }
}

function AuthGate() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notifSynced = useRef(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    const inSignIn = segments[0] === "sign-in";
    if (!isSignedIn && !inSignIn) {
      router.replace("/sign-in");
    } else if (isSignedIn && inSignIn) {
      router.replace("/(tabs)");
    }
  }, [isSignedIn, isLoaded, segments]);

  // Sync notifications on sign-in
  useEffect(() => {
    if (isSignedIn && !notifSynced.current) {
      notifSynced.current = true;
      syncNotifications(getToken);
    }
    if (!isSignedIn) {
      notifSynced.current = false;
    }
  }, [isSignedIn, getToken]);

  // Re-sync when app comes back to foreground (refreshes scheduled notifications)
  useEffect(() => {
    if (!isSignedIn) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncNotifications(getToken);
      }
    });
    return () => sub.remove();
  }, [isSignedIn, getToken]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="asset/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="capital-outlook" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="investment-ledger" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="job/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="properties" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="add-asset" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="diy-guides" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="guide/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="find-a-pro" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="upgrade" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="report" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="transfer" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthGate />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default function RootLayoutWithClerk() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <RootLayout />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
