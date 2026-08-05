import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

// ── Types ──────────────────────────────────────────────────────────────────────
export type InboxProperty = {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
};

export type InboxTransfer = {
  id: string;
  fromEmail: string;
  property: InboxProperty;
};

export type InboxCollaborator = {
  id: string;
  invitedEmail: string;
  property: InboxProperty;
};

export type Inbox = {
  transfers: InboxTransfer[];
  collaboratorInvites: InboxCollaborator[];
};

// ── Property row ───────────────────────────────────────────────────────────────
function PropertyRow({ name, address, city, state, colors }: InboxProperty & { colors: ReturnType<typeof useColors> }) {
  const parts = [address, city, state].filter(Boolean).join(", ");
  return (
    <View style={rowStyles.wrap}>
      <View style={[rowStyles.iconBox, { backgroundColor: colors.muted }]}>
        <Feather name="home" size={14} color={colors.mutedForeground} />
      </View>
      <View style={rowStyles.text}>
        <Text style={[rowStyles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={rowStyles.addrRow}>
          <Feather name="map-pin" size={10} color={colors.mutedForeground} />
          <Text style={[rowStyles.addr, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
            {parts}
          </Text>
        </View>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 13 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  addr: { fontSize: 11, flex: 1 },
});

// ── Main sheet ─────────────────────────────────────────────────────────────────
type Props = {
  visible: boolean;
  inbox: Inbox;
  onClose: () => void;
  onInboxChange: (inbox: Inbox) => void;
};

export function PendingInvitesSheet({ visible, inbox, onClose, onInboxChange }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const totalItems = inbox.transfers.length + inbox.collaboratorInvites.length;

  async function claimTransfer(transfer: InboxTransfer) {
    setPending((p) => ({ ...p, [transfer.id]: true }));
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/inbox/transfers/${transfer.id}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const updated: Inbox = {
        ...inbox,
        transfers: inbox.transfers.filter((t) => t.id !== transfer.id),
      };
      onInboxChange(updated);
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not claim property. Please try again.");
    } finally {
      setPending((p) => ({ ...p, [transfer.id]: false }));
    }
  }

  async function acceptCollab(collab: InboxCollaborator) {
    setPending((p) => ({ ...p, [collab.id]: true }));
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/inbox/collaborators/${collab.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const updated: Inbox = {
        ...inbox,
        collaboratorInvites: inbox.collaboratorInvites.filter((c) => c.id !== collab.id),
      };
      onInboxChange(updated);
      await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      await queryClient.refetchQueries({ queryKey: ["/api/properties"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not accept invite. Please try again.");
      setPending((p) => ({ ...p, [collab.id]: false }));
    }
  }

  async function declineCollab(collab: InboxCollaborator) {
    setPending((p) => ({ ...p, [collab.id]: true }));
    try {
      const token = await getToken();
      await fetch(`${baseUrl}/api/inbox/collaborators/${collab.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated: Inbox = {
        ...inbox,
        collaboratorInvites: inbox.collaboratorInvites.filter((c) => c.id !== collab.id),
      };
      onInboxChange(updated);
      Haptics.selectionAsync();
    } catch {
      Alert.alert("Error", "Could not decline invite. Please try again.");
    } finally {
      setPending((p) => ({ ...p, [collab.id]: false }));
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={sheetStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <View style={[sheetStyles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
        {/* Handle */}
        <View style={[sheetStyles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[sheetStyles.header, { borderBottomColor: colors.border }]}>
          <View style={sheetStyles.headerLeft}>
            <View style={[sheetStyles.headerIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="mail" size={15} color={colors.primary} />
            </View>
            <View>
              <Text style={[sheetStyles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Property Invitations
              </Text>
              <Text style={[sheetStyles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {totalItems} pending
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={[sheetStyles.closeBtn, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Deed transfers */}
          {inbox.transfers.map((t) => (
            <View
              key={t.id}
              style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* Type badge */}
              <View style={cardStyles.typeBadge}>
                <View style={[cardStyles.typeIcon, { backgroundColor: "#fef3c7" }]}>
                  <Feather name="file-text" size={12} color="#d97706" />
                </View>
                <Text style={[cardStyles.typeLabel, { color: "#b45309", fontFamily: "Inter_600SemiBold" }]}>
                  DEED TRANSFER
                </Text>
              </View>

              <PropertyRow {...t.property} colors={colors} />

              <Text style={[cardStyles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>{t.fromEmail}</Text>
                {" "}has transferred ownership of this home to you.
              </Text>

              <TouchableOpacity
                style={[cardStyles.acceptBtn, { backgroundColor: colors.primary, opacity: pending[t.id] ? 0.7 : 1 }]}
                onPress={() => claimTransfer(t)}
                disabled={!!pending[t.id]}
                activeOpacity={0.8}
              >
                {pending[t.id] ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="check" size={14} color="#fff" />
                    <Text style={[cardStyles.acceptText, { fontFamily: "Inter_600SemiBold" }]}>
                      Accept &amp; Claim Property
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))}

          {/* Collaborator invites */}
          {inbox.collaboratorInvites.map((c) => (
            <View
              key={c.id}
              style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* Type badge */}
              <View style={cardStyles.typeBadge}>
                <View style={[cardStyles.typeIcon, { backgroundColor: "#eff6ff" }]}>
                  <Feather name="users" size={12} color="#3b82f6" />
                </View>
                <Text style={[cardStyles.typeLabel, { color: "#1d4ed8", fontFamily: "Inter_600SemiBold" }]}>
                  COLLABORATION INVITE
                </Text>
              </View>

              <PropertyRow {...c.property} colors={colors} />

              <Text style={[cardStyles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                You've been invited to co-manage this home's dossier.
              </Text>

              <View style={cardStyles.actionRow}>
                <TouchableOpacity
                  style={[cardStyles.acceptBtn, { flex: 1, backgroundColor: colors.primary, opacity: pending[c.id] ? 0.7 : 1 }]}
                  onPress={() => acceptCollab(c)}
                  disabled={!!pending[c.id]}
                  activeOpacity={0.8}
                >
                  {pending[c.id] ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="check" size={14} color="#fff" />
                      <Text style={[cardStyles.acceptText, { fontFamily: "Inter_600SemiBold" }]}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[cardStyles.declineBtn, { borderColor: colors.border, backgroundColor: colors.muted, opacity: pending[c.id] ? 0.7 : 1 }]}
                  onPress={() => declineCollab(c)}
                  disabled={!!pending[c.id]}
                  activeOpacity={0.8}
                >
                  <Text style={[cardStyles.declineText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                    Decline
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Empty state (all resolved) */}
          {totalItems === 0 && (
            <View style={[emptyStyles.wrap, { borderColor: colors.border }]}>
              <Feather name="check-circle" size={32} color={colors.primary} style={{ opacity: 0.6 }} />
              <Text style={[emptyStyles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                All caught up!
              </Text>
              <Text style={[emptyStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No more pending invitations.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {totalItems > 0 && (
          <TouchableOpacity
            style={[footerStyles.laterBtn, { borderTopColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[footerStyles.laterText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              Remind me later
            </Text>
            <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16 },
  headerSub: { fontSize: 12, marginTop: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  typeIcon: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
  },
  typeLabel: { fontSize: 10, letterSpacing: 0.7 },
  desc: { fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: "row", gap: 8 },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  acceptText: { fontSize: 13, color: "#fff" },
  declineBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    minHeight: 40,
  },
  declineText: { fontSize: 13 },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    paddingVertical: 36,
    gap: 8,
  },
  title: { fontSize: 15 },
  sub: { fontSize: 12 },
});

const footerStyles = StyleSheet.create({
  laterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  laterText: { fontSize: 13 },
});
