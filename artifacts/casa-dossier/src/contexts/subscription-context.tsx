import { createContext, useContext, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSubscription,
  getGetSubscriptionQueryKey,
  downgradeSubscription,
  createStripeCheckout,
  createStripePortalSession,
  syncStripeCheckout,
  type Subscription,
} from "@workspace/api-client-react";

export type SubscriptionTier = "essential" | "basic" | "managed" | "concierge";

export const TIER_RANK: Record<SubscriptionTier, number> = {
  essential: 0,
  basic: 1,
  managed: 2,
  concierge: 3,
};

export function isBasicPlus(tier: SubscriptionTier | undefined | null): boolean {
  return TIER_RANK[tier ?? "essential"] >= TIER_RANK["basic"];
}

export function isManagedPlus(tier: SubscriptionTier | undefined | null): boolean {
  return TIER_RANK[tier ?? "essential"] >= TIER_RANK["managed"];
}

export type SubscriptionData = Subscription;

/** Only allow redirects to Stripe-hosted pages. */
function redirectToStripe(url: string | null | undefined) {
  if (typeof url !== "string" || !url.startsWith("https://") || !/\.stripe\.com\//.test(url)) {
    throw new Error("Invalid redirect URL");
  }
  window.location.href = url;
}

/** Surface the server's `{ error }` message, like the old raw-fetch code did. */
function serverError(err: unknown, fallback: string): Error {
  const data = (err as { data?: unknown } | null)?.data;
  const message =
    data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
      ? (data as { error: string }).error
      : fallback;
  return new Error(message);
}

type SubscriptionContextValue = {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  upgradeModalOpen: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  downgradeToFree: () => Promise<void>;
  startCheckout: (tier: "basic" | "managed" | "concierge") => Promise<void>;
  openBillingPortal: () => Promise<void>;
  syncAfterCheckout: (sessionId: string) => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  isLoading: true,
  upgradeModalOpen: false,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  downgradeToFree: async () => {},
  startCheckout: async () => {},
  openBillingPortal: async () => {},
  syncAfterCheckout: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const { data: subscription, isLoading } = useGetSubscription({
    query: { queryKey: getGetSubscriptionQueryKey(), staleTime: 5 * 60 * 1000 },
  });

  const openUpgradeModal = useCallback(() => setUpgradeModalOpen(true), []);
  const closeUpgradeModal = useCallback(() => setUpgradeModalOpen(false), []);

  const downgradeToFree = useCallback(async () => {
    try {
      await downgradeSubscription();
    } catch {
      throw new Error("Downgrade failed");
    }
    queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
  }, [queryClient]);

  const startCheckout = useCallback(async (tier: "basic" | "managed" | "concierge") => {
    let url: string | null;
    try {
      ({ url } = await createStripeCheckout({ tier }));
    } catch (err) {
      throw serverError(err, "Checkout failed");
    }
    redirectToStripe(url);
  }, []);

  const openBillingPortal = useCallback(async () => {
    let url: string | null;
    try {
      ({ url } = await createStripePortalSession());
    } catch {
      throw new Error("Portal session failed");
    }
    redirectToStripe(url);
  }, []);

  const syncAfterCheckout = useCallback(async (sessionId: string) => {
    try {
      await syncStripeCheckout({ sessionId });
    } catch {
      throw new Error("Sync failed");
    }
    queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
  }, [queryClient]);

  return (
    <SubscriptionContext.Provider value={{
      subscription: subscription ?? null,
      isLoading,
      upgradeModalOpen,
      openUpgradeModal,
      closeUpgradeModal,
      downgradeToFree,
      startCheckout,
      openBillingPortal,
      syncAfterCheckout,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
