import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { getGetCapitalOutlookQueryKey, useGetCapitalOutlook } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSelectedProperty } from "@/context/PropertyContext";
import { EmptyState } from "@/components/EmptyState";
import { useSubscription, isUpgradeRequiredError } from "@/hooks/useSubscription";
import { CATEGORY_CONFIG } from "@/components/AssetCard";
import { BarChart } from "@/components/capital/BarChart";
import { LifeBar } from "@/components/capital/LifeBar";
import { URGENCY_CONFIG, type Urgency } from "@/components/capital/urgency";
import { Trans, useTranslation } from "react-i18next";
import { intlLocale } from "@/lib/dates";

// ── Types ──────────────────────────────────────────────────────────────────────

type AssetOutlook = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  installYear: number | null;
  replacementCost: number | null;
  expectedLifespanYears: number;
  replacementYear: number | null;
  yearsRemaining: number | null;
  urgency: Urgency;
  percentLifeUsed: number | null;
};

type TimelineEntry = {
  year: number;
  projectedCost: number;
  assetNames: string[];
};

type CapitalOutlookData = {
  totalTrackedValue: number;
  assets: AssetOutlook[];
  timeline: TimelineEntry[];
  summary: {
    nextReplacement: { name: string; year: number; cost: number } | null;
    next5YearCost: number;
    next10YearCost: number;
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat(intlLocale(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function normCategory(cat: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
    roof: "Roof", roofing: "Roof", appliance: "Appliance", structural: "Structural", other: "Other",
  };
  return map[cat?.toLowerCase()] ?? cat;
}


const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡", Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CapitalOutlookScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { selectedProperty, isLoading: propsLoading } = useSelectedProperty();
  const propertyId = selectedProperty?.id;
  // No properties at all: show the empty state instead of waiting forever for a propertyId
  const noProperty = !propsLoading && !propertyId;
  const { isLoading: subLoading, isFreeTier } = useSubscription();

  // Free plan can't use Capital Outlook — don't fire a request the server will reject
  const outlook = useGetCapitalOutlook(propertyId ?? "", {
    query: {
      queryKey: getGetCapitalOutlookQueryKey(propertyId ?? ""),
      enabled: !!propertyId && !subLoading && !isFreeTier,
      retry: (n, err) => !isUpgradeRequiredError(err) && n < 2,
    },
  });
  const data: CapitalOutlookData | undefined = outlook.data;
  const upgradeRequired = isUpgradeRequiredError(outlook.error);
  const loading = outlook.isPending;
  const error = outlook.isError && !upgradeRequired;
  const locked = isFreeTier || upgradeRequired;

  const currentYear = new Date().getFullYear();

  // Sort & trim timeline
  const chartData = data
    ? (() => {
        const active = data.timeline.filter((t) => t.projectedCost > 0).map((t) => t.year);
        const maxY = active.length ? Math.min(Math.max(...active) + 1, currentYear + 15) : currentYear + 10;
        return data.timeline.filter((t) => t.year >= currentYear - 1 && t.year <= maxY);
      })()
    : [];

  const sortedAssets = data
    ? [...data.assets].sort((a, b) => {
        if (a.urgency === "unknown" && b.urgency !== "unknown") return 1;
        if (b.urgency === "unknown" && a.urgency !== "unknown") return -1;
        return (a.yearsRemaining ?? 999) - (b.yearsRemaining ?? 999);
      })
    : [];

  const criticalCount = data?.assets.filter((a) => a.urgency === "critical").length ?? 0;
  const warningCount = data?.assets.filter((a) => a.urgency === "warning").length ?? 0;
  const assetsWithCost = data?.assets.filter((a) => a.replacementCost != null) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} hitSlop={8} onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="trending-up" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("capitalOutlook.title")}
          </Text>
        </View>
        {/* Urgency badges */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {criticalCount > 0 && (
            <View style={[styles.urgencyBadge, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
              <Feather name="alert-triangle" size={10} color="#dc2626" />
              <Text style={[styles.urgencyText, { color: "#dc2626", fontFamily: "Inter_700Bold" }]}>{criticalCount}</Text>
            </View>
          )}
          {warningCount > 0 && (
            <View style={[styles.urgencyBadge, { backgroundColor: "#fffbeb", borderColor: "#fcd34d" }]}>
              <Feather name="clock" size={10} color="#d97706" />
              <Text style={[styles.urgencyText, { color: "#d97706", fontFamily: "Inter_700Bold" }]}>{warningCount}</Text>
            </View>
          )}
        </View>
      </View>

      {noProperty ? (
        <EmptyState
          icon="home"
          title={t("common.noPropertyYet")}
          description={t("capitalOutlook.noPropertyDesc")}
          actionLabel={t("common.addAProperty")}
          onAction={() => router.push("/properties")}
        />
      ) : subLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : locked ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <View style={[styles.lockIconWrap, { backgroundColor: "#10b981" + "15" }]}>
            <Feather name="lock" size={28} color="#10b981" />
          </View>
          <Text style={[{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" }]}>
            {t("common.basicPlanRequired")}
          </Text>
          <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 }]}>
            <Trans
              i18nKey="capitalOutlook.lockedDesc"
              components={{ b: <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }} /> }}
            />
          </Text>
          <TouchableOpacity
            style={[styles.upgradeBtn, { backgroundColor: "#10b981" }]}
            onPress={() => router.push("/upgrade")}
            activeOpacity={0.8}
          >
            <Feather name="star" size={14} color="#fff" />
            <Text style={[styles.upgradeBtnText, { fontFamily: "Inter_600SemiBold" }]}>{t("common.upgradeToBasic")}</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error || !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Feather name="alert-triangle" size={36} color={colors.mutedForeground + "60"} />
          <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("capitalOutlook.loadFailed")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Subtitle */}
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("capitalOutlook.subtitle")}
          </Text>

          {/* KPI cards */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiCardHighlight, { borderColor: colors.primary + "30", backgroundColor: colors.primary + "08" }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="dollar-sign" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("capitalOutlook.totalTrackedValue")}</Text>
              <Text style={[styles.kpiValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{fmt(data.totalTrackedValue)}</Text>
              <Text style={[styles.kpiSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("capitalOutlook.assetCount", { count: assetsWithCost.length })}
              </Text>
            </View>

            <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.muted }]}>
                <Feather name="calendar" size={16} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("capitalOutlook.next5Years")}</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{fmt(data.summary.next5YearCost)}</Text>
              <Text style={[styles.kpiSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {currentYear}–{currentYear + 4}
              </Text>
            </View>

            <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.muted }]}>
                <Feather name="trending-up" size={16} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("capitalOutlook.next10Years")}</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{fmt(data.summary.next10YearCost)}</Text>
              <Text style={[styles.kpiSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {currentYear}–{currentYear + 9}
              </Text>
            </View>
          </View>

          {/* Next replacement alert */}
          {data.summary.nextReplacement && (
            <View style={[styles.alertBanner, {
              borderColor: (data.summary.nextReplacement.year - currentYear) <= 3 ? "#fca5a5" : "#fcd34d",
              backgroundColor: (data.summary.nextReplacement.year - currentYear) <= 3 ? "#fef2f2" : "#fffbeb",
            }]}>
              <View style={[styles.alertIcon, {
                backgroundColor: (data.summary.nextReplacement.year - currentYear) <= 3 ? "#fecaca" : "#fde68a",
              }]}>
                <Feather
                  name="clock"
                  size={18}
                  color={(data.summary.nextReplacement.year - currentYear) <= 3 ? "#dc2626" : "#d97706"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  <Trans
                    i18nKey="capitalOutlook.nextUp"
                    values={{ name: data.summary.nextReplacement.name }}
                    components={{ b: <Text style={{ color: colors.primary }} /> }}
                  />
                </Text>
                <Text style={[styles.alertSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {data.summary.nextReplacement.year - currentYear <= 0
                    ? t("capitalOutlook.nextOverdue", { year: data.summary.nextReplacement.year, cost: fmt(data.summary.nextReplacement.cost) })
                    : t("capitalOutlook.nextIn", {
                        year: data.summary.nextReplacement.year,
                        count: data.summary.nextReplacement.year - currentYear,
                        cost: fmt(data.summary.nextReplacement.cost),
                      })}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </View>
          )}

          {/* Bar chart */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="trending-up" size={13} color={colors.mutedForeground} />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                {t("capitalOutlook.timelineTitle")}
              </Text>
            </View>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("capitalOutlook.timelineDesc")}
            </Text>

            {chartData.some((d) => d.projectedCost > 0) ? (
              <View style={{ marginTop: 12 }}>
                <BarChart data={chartData} currentYear={currentYear} colors={colors} />
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <Feather name="trending-up" size={32} color={colors.mutedForeground + "40"} />
                <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 8 }]}>
                  {t("capitalOutlook.noData")}
                </Text>
                <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }]}>
                  {t("capitalOutlook.noDataDesc")}
                </Text>
              </View>
            )}
          </View>

          {/* Asset breakdown */}
          <Text style={[styles.breakdownTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {t("capitalOutlook.assetBreakdown")}
          </Text>

          {sortedAssets.length === 0 ? (
            <View style={[styles.emptyAssets, { borderColor: colors.border }]}>
              <Feather name="trending-up" size={32} color={colors.mutedForeground + "40"} />
              <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 8 }]}>
                {t("capitalOutlook.noAssets")}
              </Text>
            </View>
          ) : (
            sortedAssets.map((asset) => {
              const cfg = URGENCY_CONFIG[asset.urgency];
              const cat = normCategory(asset.category);
              const catCfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.Other!;
              const icon = CATEGORY_ICONS[cat] ?? "📦";

              return (
                <TouchableOpacity
                  key={asset.id}
                  style={[styles.assetCard, { borderColor: cfg.borderColor, backgroundColor: colors.card }]}
                  onPress={() => router.push(`/asset/${asset.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.assetTop}>
                    <View style={[styles.assetIconWrap, { backgroundColor: catCfg.bg }]}>
                      <Text style={{ fontSize: 18 }}>{icon}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <Text style={[styles.assetName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                        {asset.name}
                      </Text>
                      <Text style={[styles.assetMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                        {[asset.brand, asset.model].filter(Boolean).join(" · ") || t(`categories.${cat}`, { defaultValue: cat })}
                      </Text>
                    </View>
                    <View style={[styles.urgencyPill, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
                      <Text style={[styles.urgencyPillText, { color: cfg.textColor, fontFamily: "Inter_700Bold" }]}>{t(`capitalOutlook.urgency.${asset.urgency}`)}</Text>
                    </View>
                  </View>

                  {/* Life bar */}
                  {asset.percentLifeUsed != null && (
                    <View style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text style={[{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {t("capitalOutlook.lifeUsed", { pct: asset.percentLifeUsed })}
                        </Text>
                        <Text style={[{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {t("capitalOutlook.lifespanYears", { count: asset.expectedLifespanYears })}
                        </Text>
                      </View>
                      <LifeBar percent={asset.percentLifeUsed} urgency={asset.urgency} />
                    </View>
                  )}

                  {/* Stats row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("capitalOutlook.installed")}</Text>
                      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {asset.installYear ?? "—"}
                      </Text>
                    </View>
                    <View style={[styles.statCell, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("capitalOutlook.replaceBy")}</Text>
                      <Text style={[styles.statValue, { color: cfg.textColor, fontFamily: "Inter_700Bold" }]}>
                        {asset.replacementYear ?? "—"}
                        {asset.yearsRemaining != null && (
                          <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 10 }}>
                            {" "}({asset.yearsRemaining <= 0 ? t("capitalOutlook.past") : t("capitalOutlook.yearsShort", { count: asset.yearsRemaining })})
                          </Text>
                        )}
                      </Text>
                    </View>
                    <View style={[styles.statCell, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("capitalOutlook.estCost")}</Text>
                      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {asset.replacementCost != null ? fmt(asset.replacementCost) : "—"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <Text style={[styles.disclaimer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("capitalOutlook.disclaimer")}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  urgencyBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, borderWidth: 1,
  },
  urgencyText: { fontSize: 11 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  kpiRow: { gap: 10, marginBottom: 16 },
  kpiCard: {
    borderRadius: 12, borderWidth: 1, padding: 14, gap: 2,
  },
  kpiCardHighlight: {},
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  kpiLabel: { fontSize: 11 },
  kpiValue: { fontSize: 22, lineHeight: 26, marginTop: 2 },
  kpiSub: { fontSize: 11 },
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16,
  },
  alertIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 13, lineHeight: 18 },
  alertSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.8 },
  sectionSub: { fontSize: 12, marginTop: 2 },
  emptyChart: { height: 120, alignItems: "center", justifyContent: "center", gap: 4 },
  breakdownTitle: { fontSize: 16, marginBottom: 12 },
  emptyAssets: {
    borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", padding: 32, marginBottom: 16,
  },
  assetCard: {
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  assetTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  assetIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  assetName: { fontSize: 14 },
  assetMeta: { fontSize: 12 },
  urgencyPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1, alignSelf: "flex-start",
  },
  urgencyPillText: { fontSize: 10 },
  statsRow: { flexDirection: "row", marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E8E5DF" },
  statCell: { flex: 1, paddingLeft: 10, gap: 2 },
  statLabel: { fontSize: 10 },
  statValue: { fontSize: 13 },
  disclaimer: { fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 8, marginBottom: 4 },
  lockIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  upgradeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, marginTop: 8 },
  upgradeBtnText: { color: "#fff", fontSize: 14 },
});
