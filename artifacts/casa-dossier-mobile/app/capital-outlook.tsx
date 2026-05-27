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
import { useListProperties } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { CATEGORY_CONFIG } from "@/components/AssetCard";

// ── Types ──────────────────────────────────────────────────────────────────────
type Urgency = "critical" | "warning" | "good" | "unknown";

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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function normCategory(cat: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
    roof: "Roof", roofing: "Roof", appliance: "Appliance", structural: "Structural", other: "Other",
  };
  return map[cat?.toLowerCase()] ?? cat;
}

const URGENCY_CONFIG: Record<Urgency, { label: string; textColor: string; bg: string; borderColor: string; barColor: string }> = {
  critical: { label: "Replace Soon",  textColor: "#dc2626", bg: "#fef2f2", borderColor: "#fca5a5", barColor: "#ef4444" },
  warning:  { label: "Plan Ahead",    textColor: "#d97706", bg: "#fffbeb", borderColor: "#fcd34d", barColor: "#f59e0b" },
  good:     { label: "Good Shape",    textColor: "#059669", bg: "#d1fae5", borderColor: "#6ee7b7", barColor: "#22c55e" },
  unknown:  { label: "No Data",       textColor: "#6b7280", bg: "#f3f4f6", borderColor: "#e5e7eb", barColor: "#94a3b8" },
};

const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡", Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

// ── SVG Bar Chart ──────────────────────────────────────────────────────────────
function BarChart({ data, currentYear, colors }: { data: TimelineEntry[]; currentYear: number; colors: ReturnType<typeof useColors> }) {
  const { Svg, Rect, Line, Text: SvgText } = require("react-native-svg");
  const width = 340, height = 180, padL = 44, padR = 8, padT = 10, padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxCost = Math.max(...data.map((d) => d.projectedCost), 1);
  const barW = Math.min(Math.floor(chartW / data.length) - 3, 40);

  function barColor(year: number) {
    const diff = year - currentYear;
    if (diff <= 0) return "#ef4444";
    if (diff <= 3) return "#f59e0b";
    if (diff <= 8) return "#3b82f6";
    return "#22c55e";
  }

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCost * f));

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={width} height={height}>
        {/* Y-axis labels + grid */}
        {yLabels.map((v, i) => {
          const y = padT + chartH - (v / maxCost) * chartH;
          return (
            <React.Fragment key={i}>
              <Line x1={padL - 4} y1={y} x2={padL + chartW} y2={y}
                stroke={colors.border} strokeWidth={0.5} strokeDasharray="3 3" />
              <SvgText x={padL - 6} y={y + 3} fontSize={8} fill={colors.mutedForeground} textAnchor="end">
                {v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Bars */}
        {data.map((entry, i) => {
          const barH = Math.max((entry.projectedCost / maxCost) * chartH, entry.projectedCost > 0 ? 2 : 0);
          const x = padL + (i * chartW) / data.length + (chartW / data.length - barW) / 2;
          const y = padT + chartH - barH;
          const isToday = entry.year === currentYear;
          return (
            <React.Fragment key={entry.year}>
              <Rect
                x={x} y={y} width={barW} height={barH}
                fill={barColor(entry.year)}
                fillOpacity={entry.projectedCost > 0 ? 1 : 0.12}
                rx={3}
              />
              {isToday && (
                <Line
                  x1={x + barW / 2} y1={padT} x2={x + barW / 2} y2={padT + chartH}
                  stroke={colors.primary} strokeWidth={1.5} strokeDasharray="3 2"
                />
              )}
              <SvgText
                x={x + barW / 2} y={height - 6}
                fontSize={8} fill={colors.mutedForeground} textAnchor="middle"
              >
                {entry.year % 2 === 0 || data.length <= 8 ? String(entry.year) : ""}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={chartStyles.legend}>
        {[
          { color: "#ef4444", label: "Past due" },
          { color: "#f59e0b", label: "≤3 yr" },
          { color: "#3b82f6", label: "4–8 yr" },
          { color: "#22c55e", label: "9+ yr" },
        ].map(({ color, label }) => (
          <View key={label} style={chartStyles.legendItem}>
            <View style={[chartStyles.legendDot, { backgroundColor: color }]} />
            <Text style={[chartStyles.legendText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  legend: { flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10 },
});

// ── Life bar ───────────────────────────────────────────────────────────────────
function LifeBar({ percent, urgency }: { percent: number; urgency: Urgency }) {
  const color = URGENCY_CONFIG[urgency].barColor;
  return (
    <View style={lifeStyles.track}>
      <View style={[lifeStyles.fill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}
const lifeStyles = StyleSheet.create({
  track: { height: 5, borderRadius: 3, backgroundColor: "#E8E5DF", overflow: "hidden", marginVertical: 4 },
  fill: { height: 5, borderRadius: 3 },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CapitalOutlookScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: properties = [] } = useListProperties();
  const propertyId = (properties[0] as any)?.id as string | undefined;

  const [data, setData] = useState<CapitalOutlookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    setError(false);
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${baseUrl}/api/properties/${propertyId}/capital-outlook`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [propertyId]);

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="trending-up" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Capital Outlook
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

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error || !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Feather name="alert-triangle" size={36} color={colors.mutedForeground + "60"} />
          <Text style={[{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Could not load Capital Outlook data.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Subtitle */}
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Projected replacement costs for your home's major systems — so you're never surprised.
          </Text>

          {/* KPI cards */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiCardHighlight, { borderColor: colors.primary + "30", backgroundColor: colors.primary + "08" }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="dollar-sign" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Total Tracked Value</Text>
              <Text style={[styles.kpiValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{fmt(data.totalTrackedValue)}</Text>
              <Text style={[styles.kpiSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {assetsWithCost.length} asset{assetsWithCost.length !== 1 ? "s" : ""}
              </Text>
            </View>

            <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.muted }]}>
                <Feather name="calendar" size={16} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Next 5-Year Spend</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{fmt(data.summary.next5YearCost)}</Text>
              <Text style={[styles.kpiSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {currentYear}–{currentYear + 4}
              </Text>
            </View>

            <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.muted }]}>
                <Feather name="trending-up" size={16} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Next 10-Year Spend</Text>
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
                  Next Up: <Text style={{ color: colors.primary }}>{data.summary.nextReplacement.name}</Text>
                </Text>
                <Text style={[styles.alertSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {`Projected ${data.summary.nextReplacement.year} (${
                    data.summary.nextReplacement.year - currentYear <= 0
                      ? "overdue"
                      : `${data.summary.nextReplacement.year - currentYear}yr away`
                  }) — est. ${fmt(data.summary.nextReplacement.cost)}`}
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
                REPLACEMENT COST TIMELINE
              </Text>
            </View>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Year-by-year capital expenditure projection
            </Text>

            {chartData.some((d) => d.projectedCost > 0) ? (
              <View style={{ marginTop: 12 }}>
                <BarChart data={chartData} currentYear={currentYear} colors={colors} />
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <Feather name="trending-up" size={32} color={colors.mutedForeground + "40"} />
                <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 8 }]}>
                  No replacement data yet
                </Text>
                <Text style={[{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }]}>
                  Add assets with replacement costs to see the timeline
                </Text>
              </View>
            )}
          </View>

          {/* Asset breakdown */}
          <Text style={[styles.breakdownTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Asset Breakdown
          </Text>

          {sortedAssets.length === 0 ? (
            <View style={[styles.emptyAssets, { borderColor: colors.border }]}>
              <Feather name="trending-up" size={32} color={colors.mutedForeground + "40"} />
              <Text style={[{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 8 }]}>
                No assets to analyze
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
                        {[asset.brand, asset.model].filter(Boolean).join(" · ") || cat}
                      </Text>
                    </View>
                    <View style={[styles.urgencyPill, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
                      <Text style={[styles.urgencyPillText, { color: cfg.textColor, fontFamily: "Inter_700Bold" }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  {/* Life bar */}
                  {asset.percentLifeUsed != null && (
                    <View style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text style={[{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          Life used: {asset.percentLifeUsed}%
                        </Text>
                        <Text style={[{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {asset.expectedLifespanYears}yr lifespan
                        </Text>
                      </View>
                      <LifeBar percent={asset.percentLifeUsed} urgency={asset.urgency} />
                    </View>
                  )}

                  {/* Stats row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statCell}>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Installed</Text>
                      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {asset.installYear ?? "—"}
                      </Text>
                    </View>
                    <View style={[styles.statCell, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Replace by</Text>
                      <Text style={[styles.statValue, { color: cfg.textColor, fontFamily: "Inter_700Bold" }]}>
                        {asset.replacementYear ?? "—"}
                        {asset.yearsRemaining != null && (
                          <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 10 }}>
                            {" "}({asset.yearsRemaining <= 0 ? "past" : `${asset.yearsRemaining}yr`})
                          </Text>
                        )}
                      </Text>
                    </View>
                    <View style={[styles.statCell, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Est. Cost</Text>
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
            Replacement timelines are estimates based on industry-standard lifespans. Costs are in today's dollars and do not account for inflation.
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
});
