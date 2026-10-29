import React, { createContext, useContext } from "react";
import { useAuth } from "@clerk/expo";
import { getGetInboxQueryKey, useGetInbox, type Inbox } from "@workspace/api-client-react";

const EMPTY_INBOX: Inbox = { transfers: [], collaboratorInvites: [] };

interface InboxContextValue {
  inbox: Inbox;
  pendingCount: number;
}

const InboxContext = createContext<InboxContextValue>({ inbox: EMPTY_INBOX, pendingCount: 0 });

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  // Single source of truth for the inbox — Home and the tab badges both read from here.
  // A failed load just shows an empty inbox.
  const { data } = useGetInbox({
    query: { queryKey: getGetInboxQueryKey(), enabled: !!isSignedIn, staleTime: 30_000 },
  });

  const inbox = data ?? EMPTY_INBOX;
  const pendingCount =
    (inbox.transfers?.length ?? 0) + (inbox.collaboratorInvites?.length ?? 0);

  return (
    <InboxContext.Provider value={{ inbox, pendingCount }}>
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox(): Inbox {
  return useContext(InboxContext).inbox;
}

export function useInboxPendingCount(): number {
  return useContext(InboxContext).pendingCount;
}
