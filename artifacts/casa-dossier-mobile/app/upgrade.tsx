import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

type SubscriptionTier = "essential" | "basic" | "managed" | "concierge";
const TIER_RANK: Record<SubscriptionTier, number> = { essential: 0, basic: 1, managed: 2, concierge: 3 };

type Plan = {
  id: SubscriptionTier;
  name: string;
  price: string;
  priceNote: string;
  icon: keyof typeof Feather.glyphMap;
  accentColor: string;
  badge?: string;
  paid: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "essential",
    name: "Essential",
    price: "Free",
    priceNote: "forever",
    icon: "shield",
    accentColor: "#94a3b8",
    paid: false,
    features: [
      "1 property",
      "1 free AI asset scan",
      "Manual maintenance tasks",
      "Asset tracking",
      "Service history log",
      "DIY guides library",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: "$9.99",
    priceNote: "/ month",
    icon: "star",
    accentColor: "#10b981",
    badge: "Most Popular",
    paid: true,
    features: [
      "1 property",
      "Unlimited AI asset scans",
      "AI-generated maintenance plans",
      "Investment Ledger reporting",
      "Capital Outlook projections",
      "Asset health scoring",
      "Full maintenance history",
    ],
  },
  {
    id: "managed",
    name: "Managed",
    price: "$35",
    priceNote: "/ month",
    icon: "briefcase",
    accentColor: "#3b82f6",
    badge: "For Landlords",
    paid: true,
    features: [
      "Up to 5 properties",
      "Professional onboarding",
      "Quarterly HVAC filter delivery",
      "15% off CasaService calls",
      "1 free service credit / year",
      "Annual visual inspection",
    ],
  },
  {
    id: "concierge",
    name: "Concierge",
    price: "$99",
    priceNote: "/ month",
    icon: "award",
    accentColor: "#f59e0b",
    badge: "Best Value",
    paid: true,
    features: [
      "Unlimited properties",
      "Same-day priority support",
      "25% off CasaService calls",
      "4 free service credits / year",
      "Dedicated home advisor",
    ],
  },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { getToken } = useAuth();
  const qc = useQueryClient();

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "";

  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${base}/api/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json() as Promise<{ tier: SubscriptionTier; propertyLimit: number; aiScansUsed: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const currentTier: SubscriptionTier = subscription?.tier ?? "essential";
  const currentRank = TIER_RANK[currentTier];

  async function handleUpgrade(tier: SubscriptionTier) {
    Haptics.selectionAsync();
    setLoadingTier(tier);
    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      const { url } = await res.json();
      if (typeof url === "string" && url.startsWith("https://")) {
        await Linking.openURL(url);
      } else {
        throw new Error("Invalid checkout URL");
      }
    } catch {
      Alert.alert("Error", "Could not start checkout. Please try again or upgrade via the web app.");
    } finally {
      setLoadingTier(null);
    }
  }

  async function handleManageBilling() {
    Haptics.selectionAsync();
    setLoadingTier("essential");
    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/stripe/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Portal failed");
      const { url } = await res.json();
      if (typeof url === "string" && url.startsWith("https://")) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert("Error", "Could not open billing portal. Please try via the web app.");
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={[s.headerIcon, { backgroundColor: "#f59e0b18" }]}>
            <Feather name="star" size={16} color="#f59e0b" />
          </View>
          <View>
            <Text style={[s.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Your Plan
            </Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Unlock more from Casa Dossier
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Current plan banner */}
          {subscription && (
            <View style={[s.currentBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[s.currentText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                You're on the <Text style={{ fontFamily: "Inter_700Bold" }}>{PLANS.find((p) => p.id === currentTier)?.name ?? currentTier}</Text> plan
              </Text>
            </View>
          )}

          {/* Plan cards */}
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.id === currentTier;
            const isDowngrade = TIER_RANK[plan.id] < currentRank;
            const busy = loadingTier === plan.id;
            const accent = plan.accentColor;

            return (
              <View
                key={plan.id}
                style={[
                  s.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isCurrentPlan ? accent : colors.border,
                    borderWidth: isCurrentPlan ? 2 : 1,
                  },
                ]}
              >
                {/* Card header */}
                <View style={s.planTop}>
                  <View style={[s.planIcon, { backgroundColor: accent + "18" }]}>
                    <Feather name={plan.icon} size={18} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <Text style={[s.planName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {plan.name}
                      </Text>
                      {plan.badge && (
                        <View style={[s.planBadge, { backgroundColor: accent + "20" }]}>
                          <Text style={[s.planBadgeText, { color: accent, fontFamily: "Inter_600SemiBold" }]}>{plan.badge}</Text>
                        </View>
                      )}
                      {isCurrentPlan && (
                        <View style={[s.planBadge, { backgroundColor: accent + "20" }]}>
                          <Text style={[s.planBadgeText, { color: accent, fontFamily: "Inter_600SemiBold" }]}>Current</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 2 }}>
                      <Text style={[s.planPrice, { color: accent, fontFamily: "Inter_700Bold" }]}>{plan.price}</Text>
                      <Text style={[s.planPriceNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{plan.priceNote}</Text>
                    </View>
                  </View>
                </View>

                {/* Features */}
                <View style={[s.featureList, { borderTopColor: colors.border }]}>
                  {plan.features.map((feat) => (
                    <View key={feat} style={s.featureRow}>
                      <Feather name="check" size={13} color={accent} />
                      <Text style={[s.featureText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{feat}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA */}
                {!isCurrentPlan && plan.paid && !isDowngrade && (
                  <TouchableOpacity
                    onPress={() => handleUpgrade(plan.id)}
                    disabled={busy || !!loadingTier}
                    style={[s.upgradeBtn, { backgroundColor: accent, opacity: (busy || !!loadingTier) ? 0.7 : 1 }]}
                    activeOpacity={0.8}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Feather name="external-link" size={14} color="#fff" />
                    )}
                    <Text style={[s.upgradeBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                      {busy ? "Opening…" : `Upgrade to ${plan.name}`}
                    </Text>
                  </TouchableOpacity>
                )}
                {isCurrentPlan && plan.paid && (
                  <TouchableOpacity
                    onPress={handleManageBilling}
                    disabled={!!loadingTier}
                    style={[s.manageBtn, { borderColor: colors.border, opacity: !!loadingTier ? 0.6 : 1 }]}
                    activeOpacity={0.8}
                  >
                    <Feather name="credit-card" size={14} color={colors.mutedForeground} />
                    <Text style={[s.manageBtnText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                      Manage Billing
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <Text style={[s.footnote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Upgrade opens a secure Stripe checkout in your browser. Cancel anytime.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17 },
  headerSub: { fontSize: 11, marginTop: 1 },
  currentBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  currentText: { fontSize: 14 },
  planCard: { borderRadius: 16, overflow: "hidden" },
  planTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 12 },
  planIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  planName: { fontSize: 17 },
  planBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  planBadgeText: { fontSize: 10 },
  planPrice: { fontSize: 22 },
  planPriceNote: { fontSize: 12 },
  featureList: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12, gap: 7 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, flex: 1 },
  upgradeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginBottom: 14, borderRadius: 12, paddingVertical: 12 },
  upgradeBtnText: { color: "#fff", fontSize: 14 },
  manageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginBottom: 14, borderRadius: 12, borderWidth: 1, paddingVertical: 11 },
  manageBtnText: { fontSize: 13 },
  footnote: { textAlign: "center", fontSize: 11, marginTop: 4, lineHeight: 17 },
});
