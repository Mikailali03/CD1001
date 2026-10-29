import { useAuth } from "@clerk/expo";
import {
  getGetSubscriptionQueryKey,
  useGetSubscription,
  type SubscriptionTier,
} from "@workspace/api-client-react";

export type { SubscriptionTier };
export const TIER_RANK: Record<SubscriptionTier, number> = { essential: 0, basic: 1, managed: 2, concierge: 3 };

/**
 * Current user's plan. Shares the generated /api/subscription cache with
 * upgrade.tsx and HealthScoreModal.
 *
 * `isFreeTier` is only true once the plan has actually loaded as essential —
 * a failed lookup doesn't lock paid users out (the server still enforces it).
 */
export function useSubscription() {
  const { isSignedIn } = useAuth();
  const { data: subscription, isLoading } = useGetSubscription({
    query: {
      queryKey: getGetSubscriptionQueryKey(),
      enabled: !!isSignedIn,
      staleTime: 5 * 60 * 1000,
    },
  });

  const isFreeTier = !!subscription && (TIER_RANK[subscription.tier] ?? 0) < 1;

  return { subscription, isLoading, isFreeTier };
}

export { isUpgradeRequiredError } from "@/lib/api-errors";
