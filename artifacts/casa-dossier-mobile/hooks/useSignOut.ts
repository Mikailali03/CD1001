import { useCallback } from "react";
import { useAuth, useClerk } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { unregisterPushToken } from "@workspace/api-client-react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getExpoPushToken, isExpoGo } from "@/lib/push-token";
import { SELECTED_PROPERTY_STORAGE_KEY } from "@/context/PropertyContext";
import { clearNotificationSync } from "@/lib/notifications";

/**
 * Signs the user out and wipes everything tied to their session:
 * unregisters this device's push token, cancels scheduled local reminders,
 * ends the Clerk session, then clears the React Query cache.
 *
 * The push-token and notification steps are best-effort — a failure there
 * never blocks the sign-out itself.
 */
export function useSignOut() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    // Remote push tokens are only registered outside Expo Go (see lib/notifications.ts)
    if (!isExpoGo) {
      try {
        const perm = (await Notifications.getPermissionsAsync()) as unknown as { granted: boolean };
        const authToken = await getToken();
        if (perm.granted && authToken) {
          const pushToken = await getExpoPushToken();
          await unregisterPushToken({ token: pushToken });
        }
      } catch {
        // Best-effort
      }
    }

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Best-effort
    }

    try {
      await AsyncStorage.removeItem(SELECTED_PROPERTY_STORAGE_KEY);
      await clearNotificationSync();
    } catch {
      // Best-effort
    }

    await signOut();
    queryClient.clear();
  }, [getToken, signOut, queryClient]);
}
