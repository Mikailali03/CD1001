import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Href } from "expo-router";
import {
  listUpcomingMaintenance,
  registerPushToken,
  type UpcomingMaintenanceTask,
} from "@workspace/api-client-react";
import { getExpoPushToken, isExpoGo } from "@/lib/push-token";
import i18n from "@/i18n";

// Android channel id. Server pushes don't set a channelId, so Expo delivers them to
// "default" — using the same id keeps remote and local reminders in one channel.
export const ANDROID_CHANNEL_ID = "default";

// Last successful sync: { userId, pushToken, at } — see syncNotifications
const SYNC_STORAGE_KEY = "casa-dossier.notificationSync";
// Set once we've shown the "turn on reminders?" explanation, so we never nag twice
export const PERMISSION_PROMPTED_STORAGE_KEY = "casa-dossier.notificationPermissionPrompted";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

type Perm = { granted: boolean; canAskAgain: boolean };

export async function getNotificationPermission(): Promise<Perm> {
  return (await Notifications.getPermissionsAsync()) as unknown as Perm;
}

export async function requestNotificationPermission(): Promise<Perm> {
  // Android 13+ only shows the system prompt once a channel exists
  await ensureAndroidChannel();
  return (await Notifications.requestPermissionsAsync()) as unknown as Perm;
}

// Must exist before scheduling or registering for push on Android 8+
export async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: i18n.t("notifications.channelName"),
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#3d7a5f",
  });
}

async function scheduleLocalMaintenanceNotifications(tasks: UpcomingMaintenanceTask[]) {
  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  for (const task of tasks) {
    const dueDate = new Date(`${task.nextDueDate}T08:00:00`);
    // Same shape as the server's maintenance push so the tap handler treats both alike
    const data = { screen: "maintenance", taskId: task.id, assetId: task.assetId };

    // 3-day advance reminder
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    if (reminderDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t("notifications.reminderTitle"),
          body: i18n.t("notifications.reminderBody", { task: task.title, asset: task.assetName }),
          data,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          channelId: ANDROID_CHANNEL_ID,
        },
      });
    }

    // On-the-day reminder
    if (dueDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t("notifications.dueTodayTitle"),
          body: i18n.t("notifications.dueTodayBody", { task: task.title, asset: task.assetName }),
          data,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dueDate,
          channelId: ANDROID_CHANNEL_ID,
        },
      });
    }
  }
}

/**
 * Registers this device's push token with the server and refreshes the local
 * fallback reminders. Never asks for permission — that only happens after the
 * explanation in AuthGate or from Settings.
 *
 * Debounced: runs at most once a day per user, unless the push token changed
 * or `force` is set (e.g. right after permission is granted).
 */
export async function syncNotifications(
  getToken: () => Promise<string | null>,
  userId: string,
  { force = false }: { force?: boolean } = {},
) {
  try {
    const perm = await getNotificationPermission();
    if (!perm.granted) return;

    await ensureAndroidChannel();

    // Remote push isn't supported in Expo Go SDK 53+ — local reminders only
    const pushToken = isExpoGo ? null : await getExpoPushToken();

    if (!force) {
      const raw = await AsyncStorage.getItem(SYNC_STORAGE_KEY);
      const last = raw ? (JSON.parse(raw) as { userId: string; pushToken: string | null; at: number }) : null;
      if (
        last &&
        last.userId === userId &&
        last.pushToken === pushToken &&
        Date.now() - last.at < SYNC_INTERVAL_MS
      ) {
        return;
      }
    }

    const authToken = await getToken();
    if (!authToken) return;

    if (pushToken) {
      try {
        await registerPushToken({ token: pushToken, platform: Platform.OS });
      } catch {
        return; // retry on the next foreground
      }
    }

    // Local fallbacks (and the only reminders in Expo Go)
    try {
      const { tasks } = await listUpcomingMaintenance();
      await scheduleLocalMaintenanceNotifications(tasks);
    } catch {
      // Keep whatever was scheduled before
    }

    await AsyncStorage.setItem(
      SYNC_STORAGE_KEY,
      JSON.stringify({ userId, pushToken, at: Date.now() }),
    );
  } catch {
    // Best-effort — never crash
  }
}

// Forget the last sync so the next sign-in registers this device again
export async function clearNotificationSync() {
  await AsyncStorage.removeItem(SYNC_STORAGE_KEY);
}

/**
 * Maps a notification's data payload to a route. Payloads sent by the server
 * (`sendPushToUser`) and by the local reminders above:
 *   { screen: "job", jobId }                       → job detail
 *   { screen: "maintenance", assetId?, taskId }    → asset detail, or Home's maintenance inbox
 */
export function routeForNotificationData(data: Record<string, unknown> | undefined): Href | null {
  if (!data) return null;
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const jobId = str(data.jobId);
  const assetId = str(data.assetId);
  const taskId = str(data.taskId);

  if (data.screen === "job" && jobId) return `/job/${jobId}` as Href;
  if (assetId) return `/asset/${assetId}` as Href;
  if (data.screen === "maintenance" || taskId) return "/(tabs)" as Href;
  return null;
}
