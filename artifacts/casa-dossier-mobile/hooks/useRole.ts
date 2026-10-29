import { useAuth } from "@clerk/expo";
import {
  getGetUserProfileQueryKey,
  useGetUserProfile,
  type UserProfile,
} from "@workspace/api-client-react";

export type AppRole = "homeowner" | "technician" | "admin";

/** HTTP status of an API error from the generated client, if any. */
export function apiErrorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

/** The server's `{ error }` message from an API error, if any. */
export function apiErrorMessage(err: unknown): string | undefined {
  const data = (err as { data?: unknown } | null)?.data;
  const msg = (data as { error?: unknown } | null)?.error;
  return typeof msg === "string" && msg ? msg : undefined;
}

/**
 * The signed-in user's role, from GET /user/profile.
 *
 * Roles are assigned by admins only — a missing profile (404) means a plain
 * homeowner. Other errors (offline, 5xx) also fall back to homeowner so the
 * user is never stranded; the server enforces technician access regardless,
 * and the next successful refetch moves them to the right app.
 */
export function useRole() {
  const { isSignedIn, isLoaded } = useAuth();
  const query = useGetUserProfile({
    query: {
      queryKey: getGetUserProfileQueryKey(),
      enabled: !!isSignedIn,
      staleTime: 30_000,
      retry: (failureCount, err) => apiErrorStatus(err) !== 404 && failureCount < 2,
    },
  });

  const profile: UserProfile | undefined = query.data;
  const role: AppRole = profile?.role ?? "homeowner";
  // Only "loading" before the first answer; background refetches keep the current role.
  const isLoading = !isLoaded || (!!isSignedIn && query.isPending && query.fetchStatus !== "idle");

  return {
    role,
    profile,
    isTechnician: role === "technician",
    isAdmin: role === "admin",
    /** Can use the technician app (technicians and admins, matching the server's check). */
    canUseTechApp: role === "technician" || role === "admin",
    isLoading,
    refetch: query.refetch,
  };
}
