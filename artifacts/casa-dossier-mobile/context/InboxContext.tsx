import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import type { Inbox } from "@/components/PendingInvitesSheet";

interface InboxContextValue {
  pendingCount: number;
}

const InboxContext = createContext<InboxContextValue>({ pendingCount: 0 });

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  // Uses the same query key as index.tsx so both share the cached response
  const { data } = useQuery<Inbox>({
    queryKey: ["inbox"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { transfers: [], collaboratorInvites: [] };
      return res.json();
    },
    staleTime: 30_000,
  });

  const pendingCount =
    (data?.transfers?.length ?? 0) + (data?.collaboratorInvites?.length ?? 0);

  return (
    <InboxContext.Provider value={{ pendingCount }}>
      {children}
    </InboxContext.Provider>
  );
}

export function useInboxPendingCount(): number {
  return useContext(InboxContext).pendingCount;
}
