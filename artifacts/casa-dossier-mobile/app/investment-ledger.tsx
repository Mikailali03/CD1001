import React, { useState, useEffect } from "react";
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
import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useListProperties } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { format } from "date-fns";

type SubscriptionTier = "essential" | "basic" | "managed" | "concierge";
const TIER_RANK: Record<SubscriptionTier, number> = { essential: 0, basic: 1, managed: 2, concierge: 3 };

// ── Types ──────────────────────────────────────────────────────────────────────
type RangeKey = "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_year" | "last_year" | "all_time";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this_month",   label: "This Month" },
  { key: "last_month",   label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "last_quarter", label: "Last Quarter" },
  { key: "this_year",    label: "This Year" },
  { key: "last_year",    label: "Last Year" },
  { key: "all_time",     label: "All Time" },
];

type CategorySpend = { category: string; actual: number; expected: number };

type LedgerRecord = {
  id: string;
  description: string;
  date: string;
  cost: number | string;
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

// ── Category colours ───────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  HVAC: "#3b82f6", Plumbing: "#06b6d4", Electrical: "#eab308",
  Roof: "#78716c", Appliance: "#8b5cf6", Structural: "#22c55e", Other: "#94a3b8",
};
function catColor(cat: string) { return CAT_COLORS[cat] ?? "#94a3b8"; }

function fmt$(n: number) {
  return n === 0 ? "$0" : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ── SVG Donut Chart ────────────────────────────────────────────────────────────
function DonutChart({ data, total, colors }: { data: { name: string; value: number }[]; total: number; colors: ReturnType<typeof useColors> }) {
  const { Svg, Path, Text: SvgText } = require("react-native-svg");
  const size = 150, cx = 75, cy = 75, outerR = 60, innerR = 38;

  function polarToXY(angle: number, r: number) {
    return {
      x: cx + r * Math.cos((angle * Math.PI) / 180),
      y: cy + r * Math.sin((angle * Math.PI) / 180),
    };
  }

  function describeArc(startAngle: number, endAngle: number) {
    const s = polarToXY(startAngle, outerR);
    const e = polarToXY(endAngle, outerR);
    const si = polarToXY(startAngle, innerR);
    const ei = polarToXY(endAngle, innerR);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${s.x} ${s.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${e.x} ${e.y}`,
      `L ${ei.x} ${ei.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${si.x} ${si.y}`,
      "Z",
    ].join(" ");
  }

  let currentAngle = -90;
  const arcs = data.map((d) => {
    const sweep = (d.value / total) * 360;
    const start = currentAngle;
    currentAngle += sweep;
    return { ...d, path: describeArc(start, currentAngle - 0.5), color: catColor(d.name) };
  });

  return (
    <Svg width={size} height={size}>
      {arcs.map((arc) => (
        <Path key={arc.name} d={arc.path} fill={arc.color} />
      ))}
      <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight="700" fill={colors.foreground}>
        {fmt$(total)}
      </SvgText>
      <SvgText x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill={colors.mutedForeground}>
        total spent
      </SvgText>
    </Svg>
  );
}

// ── Compare Bar ────────────────────────────────────────────────────────────────
function CompareBar({ actual, expected, colors }: { actual: number; expected: number; colors: ReturnType<typeof useColors> }) {
  const max = Math.max(actual, expected, 1);
  const over = actual > expected && expected > 0;
  const under = actual < expected && expected > 0;
  const diff = Math.abs(actual - expected);
  const diffPct = expected > 0 ? Math.round((diff / expected) * 100) : 0;

  return (
    <View style={[compareStyles.wrap, { backgroundColor: colors.muted + "40", borderColor: colors.border }]}>
      <Text style={[compareStyles.title, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
        EXPECTED VS ACTUAL
      </Text>
      {[
        { label: "Expected", value: expected, barColor: "#94a3b8", width: (expected / max) * 100 },
        { label: "Actual",   value: actual,   barColor: over ? "#ef4444" : under ? "#22c55e" : "#3b82f6", width: (actual / max) * 100 },
      ].map(({ label, value, barColor, width }) => (
        <View key={label} style={{ gap: 4, marginTop: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={[compareStyles.barLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
            <Text style={[compareStyles.barValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={[compareStyles.track, { backgroundColor: colors.border }]}>
            <View style={[compareStyles.fill, { width: `${width}%`, backgroundColor: barColor }]} />
          </View>
        </View>
      ))}
      {expected > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 }}>
          <Feather
            name={over ? "trending-up" : under ? "trending-down" : "minus"}
            size={12}
            color={over ? "#dc2626" : under ? "#059669" : colors.mutedForeground}
          />
          <Text style={[compareStyles.verdict, {
            color: over ? "#dc2626" : under ? "#059669" : colors.mutedForeground,
            fontFamily: "Inter_600SemiBold",
          }]}>
            {over
              ? `${diffPct}% over budget ($${diff.toLocaleString(undefined, { maximumFractionDigits: 0 })} more than estimated)`
              : under
              ? `${diffPct}% under budget ($${diff.toLocaleString(undefined, { maximumFractionDigits: 0 })} saved)`
              : "On budget"}
          </Text>
        </View>
      )}
    </View>
  );
}

const compareStyles = StyleSheet.create({
  wrap: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 0 },
  title: { fontSize: 11, letterSpacing: 0.8 },
  barLabel: { fontSize: 12 },
  barValue: { fontSize: 12 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  verdict: { fontSize: 12, flex: 1 },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function InvestmentLedgerScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: properties = [] } = useListProperties();
  const propertyId = (properties[0] as any)?.id as string | undefined;

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/api/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ tier: SubscriptionTier }>;
    },
  });
  const isBasicPlus = TIER_RANK[subscription?.tier ?? "essential"] >= 1;

  const [range, setRange] = useState<RangeKey>("this_year");
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${baseUrl}/api/properties/${propertyId}/ledger?range=${range}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [propertyId, range]);

  const records = data?.records.filter((r) => r.cost && Number(r.cost) > 0) ?? [];
  const pieData = (data?.byCategory ?? []).filter((c) => c.actual > 0).map((c) => ({ name: c.category, value: c.actual }));
  const hasSpend = (data?.totals.actual ?? 0) > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="file-text" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Investment Ledger
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Maintenance spend — expected vs actual
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
              key={r.key}
              onPress={() => setRange(r.key)}
              style={[
                styles.rangeChip,
                range === r.key
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: "transparent", borderColor: colors.border },
              ]}
            >
              <Text style={[
                styles.rangeChipText,
                range === r.key
                  ? { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }
                  : { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {subLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !isBasicPlus ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <View style={[styles.lockIconWrap, { backgroundColor: "#10b981" + "15" }]}>
            <Feather name="lock" size={28} color="#10b981" />
          </View>
          <Text style={[{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" }]}>
            Basic Plan Required
          </Text>
          <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 }]}>
            Track your maintenance spend vs expectations — available on the{" "}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Basic</Text> plan and above.
          </Text>
          <TouchableOpacity
            style={[styles.upgradeBtn, { backgroundColor: "#10b981" }]}
            onPress={() => router.push("/upgrade" as any)}
            activeOpacity={0.8}
          >
            <Feather name="star" size={14} color="#fff" />
            <Text style={[styles.upgradeBtnText, { fontFamily: "Inter_600SemiBold" }]}>Upgrade to Basic — $9.99/mo</Text>
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
            Could not load ledger data
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
              SPEND BY CATEGORY
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
                          {c.category}
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
                    <Text style={[styles.legendCat, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Total</Text>
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
                  No spend recorded for this period
                </Text>
                <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
                  Log service records with costs on your asset pages to track spending here.
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
                MAINTENANCE LEDGER
              </Text>
              {records.length > 0 && (
                <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  · {records.length} record{records.length !== 1 ? "s" : ""}
                </Text>
              )}
            </View>

            {records.length === 0 ? (
              <View style={styles.emptyLedger}>
                <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  No cost records in this period
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
                            {record.assetCategory}
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
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </Text>
                    </View>
                  </View>
                ))}

                {/* Period total */}
                <View style={[styles.periodTotal, { backgroundColor: colors.muted + "40", borderTopColor: colors.border }]}>
                  <Text style={[styles.periodTotalLabel, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    PERIOD TOTAL
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
