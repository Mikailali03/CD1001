import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  Share,
  Alert,
  Clipboard,
} from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useListProperties } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { format, parseISO } from "date-fns";
import * as Haptics from "expo-haptics";

// ── Types ──────────────────────────────────────────────────────────────────────
type PendingTransfer = {
  id: string;
  propertyId: string;
  toEmail: string;
  fromEmail: string;
  token: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
};

// ── Main screen ────────────────────────────────────────────────────────────────
export default function TransferScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: properties = [] } = useListProperties();
  const property = (properties[0] as any) as { id: string; name: string; address: string } | undefined;
  const propertyId = property?.id;

  const [transfer, setTransfer] = useState<PendingTransfer | null>(null);
  const [loadingTransfer, setLoadingTransfer] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const claimUrl = transfer ? `${baseUrl}/claim/${transfer.token}` : null;

  const loadTransfer = useCallback(async () => {
    if (!propertyId) return;
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/properties/${propertyId}/transfer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setTransfer(json);
      }
    } catch {}
    finally { setLoadingTransfer(false); }
  }, [propertyId, baseUrl]);

  useEffect(() => { loadTransfer(); }, [loadTransfer]);

  async function handleInitiate() {
    if (!recipientEmail.trim() || !propertyId) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/properties/${propertyId}/transfer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: recipientEmail.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        Alert.alert("Transfer failed", body.error ?? "Something went wrong.");
        return;
      }
      const newTransfer = await res.json();
      setTransfer(newTransfer);
      setRecipientEmail("");
      setConfirmStep(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not initiate transfer. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!transfer) return;
    Alert.alert(
      "Cancel Transfer",
      "This will revoke the claim link. The new owner will no longer be able to accept.",
      [
        { text: "Keep It", style: "cancel" },
        {
          text: "Cancel Transfer",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const token = await getToken();
              await fetch(`${baseUrl}/api/transfers/${transfer.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              setTransfer(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {
              Alert.alert("Error", "Could not cancel the transfer.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function handleCopy() {
    if (!claimUrl) return;
    Clipboard.setString(claimUrl);
    setCopied(true);
    Haptics.selectionAsync();
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!claimUrl) return;
    await Share.share({
      message: `You've been invited to claim the property dossier for ${property?.name ?? "a property"}. Open this link to accept:\n\n${claimUrl}`,
      url: claimUrl,
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[hdrStyles.bar, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={hdrStyles.back} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[hdrStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Digital Deed Transfer
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Explainer */}
        <View style={[infoStyles.banner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="shield" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={[infoStyles.bannerTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Transfer your home's entire history
            </Text>
            <Text style={[infoStyles.bannerBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Generate a secure claim link for the new owner. When they accept, all assets, service records, and maintenance history transfer to their account.
            </Text>
          </View>
        </View>

        {/* Property */}
        {property && (
          <View style={[propStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="home" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[propStyles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {property.name}
              </Text>
              <Text style={[propStyles.addr, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {property.address}
              </Text>
            </View>
          </View>
        )}

        {loadingTransfer ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : transfer ? (
          /* ── Escrow state ── */
          <View>
            {/* Status card */}
            <View style={[escrowStyles.card, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
              <View style={escrowStyles.statusRow}>
                <View style={escrowStyles.statusDot} />
                <Text style={[escrowStyles.statusLabel, { color: "#92400e", fontFamily: "Inter_700Bold" }]}>
                  Transfer In Escrow
                </Text>
              </View>
              <Text style={[escrowStyles.toEmail, { color: "#92400e", fontFamily: "Inter_400Regular" }]}>
                Waiting for {transfer.toEmail} to accept
              </Text>
              {transfer.expiresAt && (
                <Text style={[escrowStyles.expires, { color: "#b45309", fontFamily: "Inter_400Regular" }]}>
                  Expires {format(parseISO(transfer.expiresAt), "MMM d, yyyy")}
                </Text>
              )}
            </View>

            {/* Claim link */}
            <Text style={[labelStyle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              CLAIM LINK
            </Text>
            <View style={[linkStyles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text
                style={[linkStyles.url, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={2}
                selectable
              >
                {claimUrl}
              </Text>
            </View>

            {/* Actions */}
            <View style={linkStyles.actions}>
              <TouchableOpacity
                style={[linkStyles.btn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Feather name="share-2" size={15} color="#fff" />
                <Text style={[linkStyles.btnText, { fontFamily: "Inter_600SemiBold" }]}>Share Link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[linkStyles.btn, { backgroundColor: copied ? "#059669" : colors.muted, flex: 0 }]}
                onPress={handleCopy}
                activeOpacity={0.8}
              >
                <Feather name={copied ? "check" : "copy"} size={15} color={copied ? "#fff" : colors.foreground} />
                <Text style={[linkStyles.btnText, { color: copied ? "#fff" : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Cancel */}
            <TouchableOpacity
              style={[cancelStyles.btn, { borderColor: colors.destructive + "66" }]}
              onPress={handleCancel}
              activeOpacity={0.7}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.destructive} size="small" />
              ) : (
                <>
                  <Feather name="x-circle" size={15} color={colors.destructive} />
                  <Text style={[cancelStyles.text, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>
                    Cancel Transfer
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Initiate form ── */
          <View>
            <Text style={[labelStyle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              NEW OWNER'S EMAIL
            </Text>
            <TextInput
              style={[inputStyles.field, {
                backgroundColor: colors.card,
                borderColor: confirmStep ? "#f59e0b" : colors.border,
                color: colors.foreground,
                fontFamily: "Inter_400Regular",
              }]}
              placeholder="newowner@email.com"
              placeholderTextColor={colors.mutedForeground}
              value={recipientEmail}
              onChangeText={(t) => { setRecipientEmail(t); setConfirmStep(false); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {confirmStep ? (
              <View>
                <View style={[confirmStyles.warn, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
                  <Feather name="alert-triangle" size={16} color="#d97706" />
                  <Text style={[confirmStyles.warnText, { color: "#92400e", fontFamily: "Inter_400Regular" }]}>
                    You are about to transfer{" "}
                    <Text style={{ fontFamily: "Inter_600SemiBold" }}>{property?.name ?? "this property"}</Text>
                    {" "}to <Text style={{ fontFamily: "Inter_600SemiBold" }}>{recipientEmail}</Text>.
                    {"\n\n"}This cannot be undone once accepted.
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[confirmStyles.btn, { backgroundColor: colors.muted, flex: 1 }]}
                    onPress={() => setConfirmStep(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={[confirmStyles.btnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      Back
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[confirmStyles.btn, { backgroundColor: "#d97706", flex: 1 }]}
                    onPress={handleInitiate}
                    activeOpacity={0.8}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[confirmStyles.btnText, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>
                        Confirm Transfer
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[inputStyles.submitBtn, {
                  backgroundColor: recipientEmail.trim() ? colors.primary : colors.muted,
                }]}
                onPress={() => {
                  if (!recipientEmail.trim()) return;
                  Haptics.selectionAsync();
                  setConfirmStep(true);
                }}
                activeOpacity={0.8}
                disabled={!recipientEmail.trim()}
              >
                <Feather name="arrow-right-circle" size={16} color={recipientEmail.trim() ? "#fff" : colors.mutedForeground} />
                <Text style={[inputStyles.submitText, {
                  color: recipientEmail.trim() ? "#fff" : colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                }]}>
                  Generate Claim Link
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Footer note */}
        <Text style={[footerStyles.note, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          The new owner must have a Casa Dossier account to accept the transfer. The link expires in 30 days.
        </Text>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const hdrStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { padding: 4, marginRight: 8 },
  title: { flex: 1, fontSize: 19 },
});

const infoStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 20,
    marginBottom: 16,
  },
  bannerTitle: { fontSize: 14, marginBottom: 4 },
  bannerBody: { fontSize: 12, lineHeight: 17 },
});

const propStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 24,
  },
  name: { fontSize: 14 },
  addr: { fontSize: 12, marginTop: 2 },
});

const escrowStyles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#f59e0b" },
  statusLabel: { fontSize: 14 },
  toEmail: { fontSize: 13, marginBottom: 4 },
  expires: { fontSize: 11 },
});

const linkStyles = StyleSheet.create({
  box: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  url: { fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginBottom: 24 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnText: { fontSize: 14, color: "#fff" },
});

const cancelStyles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
  },
  text: { fontSize: 14 },
});

const inputStyles = StyleSheet.create({
  field: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
  },
  submitText: { fontSize: 15 },
});

const confirmStyles = StyleSheet.create({
  warn: { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: "row", gap: 10 },
  warnText: { flex: 1, fontSize: 13, lineHeight: 18 },
  btn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 14 },
});

const footerStyles = StyleSheet.create({
  note: { fontSize: 12, textAlign: "center", marginTop: 32, lineHeight: 18 },
});

const labelStyle: object = {
  fontSize: 11, letterSpacing: 0.8, marginBottom: 8,
};
