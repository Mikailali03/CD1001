import { createContext, useContext, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type SubscriptionTier = "essential" | "managed" | "concierge";

export type SubscriptionData = {
  tier: SubscriptionTier;
  propertyLimit: number;
};

type SubscriptionContextValue = {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  upgradeModalOpen: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  upgradeTo: (tier: SubscriptionTier) => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  isLoading: true,
  upgradeModalOpen: false,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  upgradeTo: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const { data: subscription, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/subscription`);
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const openUpgradeModal = useCallback(() => setUpgradeModalOpen(true), []);
  const closeUpgradeModal = useCallback(() => setUpgradeModalOpen(false), []);

  const upgradeTo = useCallback(async (tier: SubscriptionTier) => {
    const res = await fetch(`${BASE}/api/subscription/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    if (!res.ok) throw new Error("Upgrade failed");
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
  }, [queryClient]);

  return (
    <SubscriptionContext.Provider value={{
      subscription: subscription ?? null,
      isLoading,
      upgradeModalOpen,
      openUpgradeModal,
      closeUpgradeModal,
      upgradeTo,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
