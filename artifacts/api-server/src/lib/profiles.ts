import type { UserProfile } from "@workspace/db";

// The unsubscribe token works without signing in, so it's never sent to
// clients (including admins); it only appears in reminder email links.
export function toPublicProfile(profile: UserProfile): Omit<UserProfile, "unsubscribeToken"> {
  const { unsubscribeToken: _token, ...rest } = profile;
  return rest;
}
