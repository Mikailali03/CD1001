import { createContext, useContext, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/hooks/use-auth-fetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type SubscriptionTier = "essential" | "managed" | "concierge";

export type SubscriptionData = {
  tier: SubscriptionTier;
  propertyLimit: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

type SubscriptionContextValue = {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  upgradeModalOpen: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  upgradeTo: (tier: SubscriptionTier) => Promise<void>;
  startCheckout: (tier: "managed" | "concierge") => Promise<void>;
  openBillingPortal: () => Promise<void>;
  syncAfterCheckout: (sessionId: string) => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  isLoading: true,
  upgradeModalOpen: false,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  upgradeTo: async () => {},
  startCheckout: async () => {},
  openBillingPortal: async () => {},
  syncAfterCheckout: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const { data: subscription, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/subscription`);
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const openUpgradeModal = useCallback(() => setUpgradeModalOpen(true), []);
  const closeUpgradeModal = useCallback(() => setUpgradeModalOpen(false), []);

  // Internal tier change (e.g. downgrade to Essential)
  const upgradeTo = useCallback(async (tier: SubscriptionTier) => {
    const res = await authFetch(`${BASE}/api/subscription/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    if (!res.ok) throw new Error("Upgrade failed");
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
  }, [queryClient, authFetch]);

  // Stripe Checkout for paid tiers
  const startCheckout = useCallback(async (tier: "managed" | "concierge") => {
    const res = await authFetch(`${BASE}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error ?? "Checkout failed");
    }
    const { url } = await res.json();
    window.location.href = url;
  }, [authFetch]);

  // Stripe billing portal (for existing subscribers)
  const openBillingPortal = useCallback(async () => {
    const res = await authFetch(`${BASE}/api/stripe/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Portal session failed");
    const { url } = await res.json();
    window.location.href = url;
  }, [authFetch]);

  // Called after Stripe redirects back on success
  const syncAfterCheckout = useCallback(async (sessionId: string) => {
    const res = await authFetch(`${BASE}/api/stripe/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) throw new Error("Sync failed");
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
  }, [queryClient, authFetch]);

  return (
    <SubscriptionContext.Provider value={{
      subscription: subscription ?? null,
      isLoading,
      upgradeModalOpen,
      openUpgradeModal,
      closeUpgradeModal,
      upgradeTo,
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
