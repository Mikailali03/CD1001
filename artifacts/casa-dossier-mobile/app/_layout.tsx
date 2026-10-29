import i18n from "@/i18n";
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
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { Alert, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PropertyProvider } from "@/context/PropertyContext";
import { API_BASE_URL } from "@/lib/config";
import {
  ensureAndroidChannel,
  getNotificationPermission,
  requestNotificationPermission,
  syncNotifications,
  PERMISSION_PROMPTED_STORAGE_KEY,
} from "@/lib/notifications";
import { RoleRoutingGate } from "@/components/tech/RoleGuard";
import { useNotificationNavigator } from "@/hooks/useNotificationNavigator";

if (API_BASE_URL) {
  setBaseUrl(API_BASE_URL);
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

function AuthGate() {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notifSynced = useRef(false);
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const handledResponseId = useRef<string | null>(null);
  // Role-aware: technicians only open their own jobs, in the technician app
  const openNotification = useNotificationNavigator();

  // Every generated-client request carries the Clerk session token. A layout effect
  // runs before any passive effect in the tree, so queries fired by screens on their
  // first commit (they subscribe in passive effects) are already authenticated.
  useLayoutEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    ensureAndroidChannel().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const inSignIn = segments[0] === "sign-in";
    if (!isSignedIn && !inSignIn) {
      router.replace("/sign-in");
    } else if (isSignedIn && inSignIn) {
      router.replace("/(tabs)");
    }
  }, [isSignedIn, isLoaded, segments]);

  // On sign-in: sync if already allowed; otherwise explain once, then ask
  useEffect(() => {
    if (!isSignedIn || !userId) {
      notifSynced.current = false;
      return;
    }
    if (notifSynced.current) return;
    notifSynced.current = true;

    let cancelled = false;
    (async () => {
      const perm = await getNotificationPermission();
      if (perm.granted) {
        syncNotifications(getToken, userId);
        return;
      }
      if (!perm.canAskAgain) return;
      if (await AsyncStorage.getItem(PERMISSION_PROMPTED_STORAGE_KEY)) return;
      // Let the dashboard settle before interrupting
      await new Promise((r) => setTimeout(r, 2500));
      if (cancelled) return;
      await AsyncStorage.setItem(PERMISSION_PROMPTED_STORAGE_KEY, "1");
      Alert.alert(
        i18n.t("notifications.promptTitle"),
        i18n.t("notifications.promptBody"),
        [
          { text: i18n.t("common.notNow"), style: "cancel" },
          {
            text: i18n.t("notifications.turnOn"),
            onPress: async () => {
              const asked = await requestNotificationPermission();
              if (asked.granted) syncNotifications(getToken, userId, { force: true });
            },
          },
        ],
      );
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId, getToken]);

  // Re-sync on foreground — syncNotifications itself limits this to once a day or a new token
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncNotifications(getToken, userId);
      }
    });
    return () => sub.remove();
  }, [isSignedIn, userId, getToken]);

  // Notification taps (including the one that cold-started the app) open the related screen
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !lastNotificationResponse) return;
    if (lastNotificationResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastNotificationResponse.notification.request.identifier;
    if (handledResponseId.current === id) return;
    handledResponseId.current = id;
    void openNotification(
      lastNotificationResponse.notification.request.content.data as Record<string, unknown> | undefined,
    );
  }, [lastNotificationResponse, isLoaded, isSignedIn]);

  return (
    <RoleRoutingGate>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(tech)" />
      <Stack.Screen name="technician-access" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="asset/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="capital-outlook" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="investment-ledger" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="job/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="properties" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="add-asset" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="diy-guides" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="guide/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="upgrade" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="report" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="transfer" options={{ animation: "slide_from_right" }} />
    </Stack>
    </RoleRoutingGate>
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
              <PropertyProvider>
                <AuthGate />
              </PropertyProvider>
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
