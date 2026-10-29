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
import { createStripeCheckout, createStripePortalSession } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";
import { Trans, useTranslation } from "react-i18next";
import { useSubscription, TIER_RANK, type SubscriptionTier } from "@/hooks/useSubscription";


// Display text lives in upgrade.* (plan names, badges, features), resolved at render
type Plan = {
  id: SubscriptionTier;
  price: string;
  /** upgrade.free / upgrade.forever / upgrade.perMonth */
  priceKey?: "free";
  icon: keyof typeof Feather.glyphMap;
  accentColor: string;
  badge?: "mostPopular" | "forLandlords" | "bestValue";
  paid: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "essential",
    price: "",
    priceKey: "free",
    icon: "shield",
    accentColor: "#94a3b8",
    paid: false,
    features: ["oneProperty", "oneFreeScan", "manualTasks", "assetTracking", "serviceLog", "diyGuides"],
  },
  {
    id: "basic",
    price: "$9.99",
    icon: "star",
    accentColor: "#10b981",
    badge: "mostPopular",
    paid: true,
    features: ["oneProperty", "unlimitedScans", "aiPlans", "ledger", "capitalOutlook", "healthScoring", "fullHistory"],
  },
  {
    id: "managed",
    price: "$35",
    icon: "briefcase",
    accentColor: "#3b82f6",
    badge: "forLandlords",
    paid: true,
    features: ["upToFive", "proOnboarding", "filterDelivery", "fifteenOff", "oneCredit", "inspection"],
  },
  {
    id: "concierge",
    price: "$99",
    icon: "award",
    accentColor: "#f59e0b",
    badge: "bestValue",
    paid: true,
    features: ["unlimitedProperties", "prioritySupport", "twentyFiveOff", "fourCredits", "advisor"],
  },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);

  const { subscription, isLoading } = useSubscription();

  const currentTier: SubscriptionTier = subscription?.tier ?? "essential";
  const currentRank = TIER_RANK[currentTier];

  async function handleUpgrade(tier: SubscriptionTier) {
    if (tier === "essential") return; // the free plan has no checkout
    Haptics.selectionAsync();
    setLoadingTier(tier);
    try {
      const { url } = await createStripeCheckout({ tier });
      if (typeof url === "string" && url.startsWith("https://")) {
        await Linking.openURL(url);
      } else {
        throw new Error("Invalid checkout URL");
      }
    } catch {
      Alert.alert(t("common.error"), t("upgrade.checkoutError"));
    } finally {
      setLoadingTier(null);
    }
  }

  async function handleManageBilling() {
    Haptics.selectionAsync();
    setLoadingTier("essential");
    try {
      const { url } = await createStripePortalSession();
      if (typeof url === "string" && url.startsWith("https://")) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert(t("common.error"), t("upgrade.portalError"));
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} hitSlop={8} onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={[s.headerIcon, { backgroundColor: "#f59e0b18" }]}>
            <Feather name="star" size={16} color="#f59e0b" />
          </View>
          <View>
            <Text style={[s.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("upgrade.yourPlan")}
            </Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("upgrade.headerSub")}
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
                <Trans
                  i18nKey="upgrade.onPlan"
                  values={{ plan: t(`upgrade.plans.${currentTier}`, { defaultValue: currentTier }) }}
                  components={{ b: <Text style={{ fontFamily: "Inter_700Bold" }} /> }}
                />
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
                        {t(`upgrade.plans.${plan.id}`)}
                      </Text>
                      {plan.badge && (
                        <View style={[s.planBadge, { backgroundColor: accent + "20" }]}>
                          <Text style={[s.planBadgeText, { color: accent, fontFamily: "Inter_600SemiBold" }]}>{t(`upgrade.badges.${plan.badge}`)}</Text>
                        </View>
                      )}
                      {isCurrentPlan && (
                        <View style={[s.planBadge, { backgroundColor: accent + "20" }]}>
                          <Text style={[s.planBadgeText, { color: accent, fontFamily: "Inter_600SemiBold" }]}>{t("upgrade.current")}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 2 }}>
                      <Text style={[s.planPrice, { color: accent, fontFamily: "Inter_700Bold" }]}>{plan.priceKey ? t("upgrade.free") : plan.price}</Text>
                      <Text style={[s.planPriceNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{plan.priceKey ? t("upgrade.forever") : t("upgrade.perMonth")}</Text>
                    </View>
                  </View>
                </View>

                {/* Features */}
                <View style={[s.featureList, { borderTopColor: colors.border }]}>
                  {plan.features.map((feat) => (
                    <View key={feat} style={s.featureRow}>
                      <Feather name="check" size={13} color={accent} />
                      <Text style={[s.featureText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{t(`upgrade.features.${feat}`)}</Text>
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
                      {busy ? t("upgrade.opening") : t("upgrade.upgradeTo", { plan: t(`upgrade.plans.${plan.id}`) })}
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
                      {t("upgrade.manageBilling")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <Text style={[s.footnote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("upgrade.footnote")}
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
