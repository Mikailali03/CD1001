import type { NotificationResponse } from "expo-notifications";

// Expo's response hook calls native APIs that are unavailable in web previews.
export function useNotificationResponse(): NotificationResponse | null {
  return null;
}
