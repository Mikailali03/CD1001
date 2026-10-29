import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMarketplaceJobDetailsQueryKey,
  getGetUserProfileQueryKey,
  getMarketplaceJobDetails,
  getUserProfile,
  type UserProfile,
} from "@workspace/api-client-react";
import { routeForNotificationData } from "@/lib/notifications";
import { techJobHref } from "@/components/tech/routes";

/**
 * Returns a role-aware handler for notification taps.
 *
 * Homeowners and admins get the existing behaviour (routeForNotificationData).
 * Technicians can't open homeowner screens, so a `{ screen: "job", jobId }`
 * push opens the technician job screen — but only when that job is assigned
 * to them. Anything else is ignored for technicians.
 */
export function useNotificationNavigator() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(
    async (data: Record<string, unknown> | undefined) => {
      let profile: UserProfile | null = null;
      try {
        profile = await queryClient.fetchQuery({
          queryKey: getGetUserProfileQueryKey(),
          queryFn: ({ signal }) => getUserProfile({ signal }),
          staleTime: 30_000,
        });
      } catch {
        profile = null; // 404 = no profile yet = homeowner
      }

      if (profile?.role !== "technician") {
        const route = routeForNotificationData(data);
        if (route) router.push(route);
        return;
      }

      const jobId = data?.screen === "job" && typeof data.jobId === "string" && data.jobId ? data.jobId : null;
      if (!jobId) return;
      try {
        const job = await queryClient.fetchQuery({
          queryKey: getGetMarketplaceJobDetailsQueryKey(jobId),
          queryFn: ({ signal }) => getMarketplaceJobDetails(jobId, { signal }),
        });
        if (job.technicianId && job.technicianId === profile.userId) {
          router.push(techJobHref(jobId));
        }
      } catch {
        // Not visible to this technician — nothing to open.
      }
    },
    [router, queryClient],
  );
}
