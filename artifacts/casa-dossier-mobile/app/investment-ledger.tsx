import React, { useState } from "react";
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
import { getGetInvestmentLedgerQueryKey, useGetInvestmentLedger } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSelectedProperty } from "@/context/PropertyContext";
import { EmptyState } from "@/components/EmptyState";
import { useSubscription, isUpgradeRequiredError } from "@/hooks/useSubscription";
import { Trans, useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dates";
import { CompareBar } from "@/components/ledger/CompareBar";
import { DonutChart } from "@/components/ledger/DonutChart";
import { catColor, fmt$ } from "@/components/ledger/categoryColors";

// ── Types ──────────────────────────────────────────────────────────────────────
type RangeKey = "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_year" | "last_year" | "all_time";

// Labels: ledger.range.<key>
const RANGES: RangeKey[] = [
  "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "all_time",
];

type CategorySpend = { category: string; actual: number; expected: number };

type LedgerRecord = {
  id: string;
  description: string;
  date: string;
  // Decimal columns can arrive as strings ("45.00")
  cost?: number | string;
  assetName: string;
  assetCategory: string;
  technicianName?: string;
  companyName?: string;
};

type LedgerData = {
  records: LedgerRecord[];
  byCategory: CategorySpend[];
  totals: { actual: number; expected: number };
};

// ── Main screen ────────────────────────────────────────────────────────────────
export default function InvestmentLedgerScreen() {
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
  const [range, setRange] = useState<RangeKey>("this_year");

  // Free plan can't use the ledger — don't fire a request the server will reject
  const ledger = useGetInvestmentLedger(propertyId ?? "", { range }, {
    query: {
      queryKey: getGetInvestmentLedgerQueryKey(propertyId ?? "", { range }),
      enabled: !!propertyId && !subLoading && !isFreeTier,
      retry: (n, err) => !isUpgradeRequiredError(err) && n < 2,
    },
  });
  const upgradeRequired = isUpgradeRequiredError(ledger.error);
  const locked = isFreeTier || upgradeRequired;
  const isBasicPlus = !subLoading && !locked;
  const data: LedgerData | undefined = ledger.data;
  const loading = ledger.isPending;

  const records = data?.records.filter((r) => r.cost && Number(r.cost) > 0) ?? [];
  const pieData = (data?.byCategory ?? []).filter((c) => c.actual > 0).map((c) => ({ name: c.category, value: c.actual }));
  const hasSpend = (data?.totals.actual ?? 0) > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} hitSlop={8} onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="file-text" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("ledger.title")}
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("ledger.headerSub")}
            </Text>
          </View>
        </View>
      </View>

      {/* Range selector */}
      {isBasicPlus && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangeRow}
          style={[styles.rangeScroll, { borderBottomColor: colors.border, backgroundColor: colors.background }]}
        >
          {RANGES.map((r) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: range === r }}
              key={r}
              onPress={() => setRange(r)}
              style={[
                styles.rangeChip,
                range === r
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: "transparent", borderColor: colors.border },
              ]}
            >
              <Text style={[
                styles.rangeChipText,
                range === r
                  ? { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }
                  : { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}>
                {t(`ledger.range.${r}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {noProperty ? (
        <EmptyState
          icon="home"
          title={t("common.noPropertyYet")}
          description={t("ledger.noPropertyDesc")}
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
              i18nKey="ledger.lockedDesc"
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
      ) : !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Feather name="tool" size={36} color={colors.mutedForeground + "40"} />
          <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {t("ledger.loadFailed")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Spend by Category */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
              {t("ledger.spendByCategory")}
            </Text>

            {hasSpend ? (
              <View style={styles.donutRow}>
                {/* Donut */}
                <DonutChart data={pieData} total={data.totals.actual} colors={colors} />

                {/* Legend */}
                <View style={styles.donutLegend}>
                  {data.byCategory.filter((c) => c.actual > 0).map((c) => {
                    const pct = data.totals.actual > 0 ? Math.round((c.actual / data.totals.actual) * 100) : 0;
                    return (
                      <View key={c.category} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: catColor(c.category) }]} />
                        <Text style={[styles.legendCat, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                          {t(`categories.${c.category}`, { defaultValue: c.category })}
                        </Text>
                        <Text style={[styles.legendPct, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{pct}%</Text>
                        <Text style={[styles.legendAmt, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                          ${c.actual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                    );
                  })}
                  <View style={[styles.legendRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 2 }]}>
                    <View style={{ width: 10 }} />
                    <Text style={[styles.legendCat, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{t("ledger.total")}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.legendAmt, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                      ${data.totals.actual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.emptySpend}>
                <Feather name="dollar-sign" size={28} color={colors.mutedForeground + "40"} />
                <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {t("ledger.noSpend")}
                </Text>
                <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
                  {t("ledger.noSpendDesc")}
                </Text>
              </View>
            )}
          </View>

          {/* Expected vs Actual */}
          <View style={{ marginBottom: 16 }}>
            <CompareBar actual={data.totals.actual} expected={data.totals.expected} colors={colors} />
          </View>

          {/* Running ledger */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                {t("ledger.maintenanceLedger")}
              </Text>
              {records.length > 0 && (
                <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  · {t("ledger.recordCount", { count: records.length })}
                </Text>
              )}
            </View>

            {records.length === 0 ? (
              <View style={styles.emptyLedger}>
                <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("ledger.noCostRecords")}
                </Text>
              </View>
            ) : (
              <View style={[styles.ledgerList, { borderColor: colors.border }]}>
                {records.map((record, idx) => (
                  <View
                    key={record.id}
                    style={[
                      styles.ledgerRow,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth: idx < records.length - 1 ? StyleSheet.hairlineWidth : 0,
                      },
                    ]}
                  >
                    <View style={[styles.ledgerCatDot, { backgroundColor: catColor(record.assetCategory) }]} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.ledgerDesc, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                        {record.description}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                        <Text style={[styles.ledgerAsset, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {record.assetName}
                        </Text>
                        <View style={[styles.catBadge, { backgroundColor: catColor(record.assetCategory) + "20" }]}>
                          <Text style={[styles.catBadgeText, { color: catColor(record.assetCategory), fontFamily: "Inter_600SemiBold" }]}>
                            {t(`categories.${record.assetCategory}`, { defaultValue: record.assetCategory })}
                          </Text>
                        </View>
                        {(record.companyName || record.technicianName) && (
                          <Text style={[styles.ledgerTech, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                            · {record.companyName || record.technicianName}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.ledgerRight}>
                      <Text style={[styles.ledgerCost, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        ${Number(record.cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Text>
                      <Text style={[styles.ledgerDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {formatDate(record.date, "MMM d, yyyy")}
                      </Text>
                    </View>
                  </View>
                ))}

                {/* Period total */}
                <View style={[styles.periodTotal, { backgroundColor: colors.muted + "40", borderTopColor: colors.border }]}>
                  <Text style={[styles.periodTotalLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    {t("ledger.periodTotal")}
                  </Text>
                  <Text style={[styles.periodTotalValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                    ${data.totals.actual.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            )}
          </View>
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
  headerIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, lineHeight: 20 },
  headerSub: { fontSize: 11, marginTop: 1 },
  rangeScroll: { height: 56, borderBottomWidth: 1 },
  rangeRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center", flexDirection: "row" },
  rangeChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1,
  },
  rangeChipText: { fontSize: 13 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.8, marginBottom: 12 },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  donutLegend: { flex: 1, gap: 7 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendCat: { flex: 1, fontSize: 12, minWidth: 0 },
  legendPct: { fontSize: 11 },
  legendAmt: { fontSize: 12, minWidth: 40, textAlign: "right" },
  emptySpend: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyLedger: { alignItems: "center", paddingVertical: 20, borderRadius: 10, borderWidth: 1, borderColor: "#E8E5DF" },
  ledgerList: { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  ledgerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12 },
  ledgerCatDot: { width: 10, height: 10, borderRadius: 2, marginTop: 4 },
  ledgerDesc: { fontSize: 13, lineHeight: 18 },
  ledgerAsset: { fontSize: 11 },
  catBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  catBadgeText: { fontSize: 9 },
  ledgerTech: { fontSize: 11 },
  ledgerRight: { alignItems: "flex-end", gap: 2 },
  ledgerCost: { fontSize: 14 },
  ledgerDate: { fontSize: 10 },
  periodTotal: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12, borderTopWidth: 1,
  },
  periodTotalLabel: { fontSize: 11, letterSpacing: 0.8 },
  periodTotalValue: { fontSize: 15 },
  lockIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  upgradeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, marginTop: 8 },
  upgradeBtnText: { color: "#fff", fontSize: 14 },
});
