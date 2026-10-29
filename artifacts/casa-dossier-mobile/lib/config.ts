import Constants from "expo-constants";

// API host (no protocol), e.g. "casadossier.com". Set per EAS build profile in eas.json,
// by the `dev` script for local runs, or as `expo.extra.apiDomain` in app.json.
const rawDomain: string | undefined =
  process.env.EXPO_PUBLIC_DOMAIN || Constants.expoConfig?.extra?.apiDomain || undefined;

const domain = rawDomain?.replace(/^https?:\/\//, "").replace(/\/+$/, "");

if (!domain && __DEV__) {
  // Without a domain every fetch becomes a relative URL, which fails on device
  console.error(
    "[config] EXPO_PUBLIC_DOMAIN is not set — API requests will fail. " +
      "Set it in your shell (see the `dev` script) or in eas.json for the build profile.",
  );
}

// Base URL for every API call, e.g. `${API_BASE_URL}/api/inbox`. Empty when unconfigured.
export const API_BASE_URL = domain ? `https://${domain}` : "";

/**
 * The value to save for an uploaded object (photo, receipt). Relative, matching
 * what the web app saves, so the same record renders on every client.
 */
export function storageUrlForObjectPath(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

/**
 * Turns a stored photo or receipt URL into one React Native can load.
 * Relative `/api/storage/...` values (saved by the web app, and by this app
 * from now on) get the API host prefixed; absolute URLs pass through.
 */
export function resolveStorageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return url;
}
