import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// True when running inside Expo Go (not a standalone/dev build)
export const isExpoGo = Constants.appOwnership === "expo";

// Expo push token for this device — the same value registered with POST /api/push-tokens
export async function getExpoPushToken(): Promise<string> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return tokenData.data;
}
