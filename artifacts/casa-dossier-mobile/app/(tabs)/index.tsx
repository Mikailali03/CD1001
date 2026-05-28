import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CasaServiceBadge } from "@/components/CasaServiceBadge";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useListProperties,
  useGetPropertySummary,
  useListMarketplaceJobs,
  type MarketplaceJob,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { MaintenanceInbox } from "@/components/MaintenanceInbox";
import { HealthScoreModal } from "@/components/HealthScoreModal";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

// ── Grade config (matches web exactly) ────────────────────────────────────────
const GRADE_CONFIG = {
  A: { color: "#3d7a5f", bg: "#3d7a5f12", label: "Excellent", cta: "Your home is in great shape!" },
  B: { color: "#4b7fb5", bg: "#4b7fb512", label: "Good",      cta: "A few quick tasks will get you to A." },
  C: { color: "#c8853a", bg: "#c8853a12", label: "Fair",      cta: "Several items need attention." },
  D: { color: "#b85a2a", bg: "#b85a2a12", label: "Poor",      cta: "Significant backlog detected." },
  F: { color: "#c0392b", bg: "#c0392b0e", label: "Critical",  cta: "Immediate action recommended." },
} as const;

type Grade = keyof typeof GRADE_CONFIG;

// ── Active Service Requests ───────────────────────────────────────────────────
const URGENCY_BORDER: Record<string, string> = {
  emergency: "#dc2626",
  high:      "#ea580c",
  medium:    "#d97706",
  low:       "#94a3b8",
};
const URGENCY_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  emergency: "alert-circle",
  high:      "alert-circle",
  medium:    "clock",
  low:       "clock",
};

function ActiveServiceRequests({ colors, onJobPress, propertyId }: { colors: ReturnType<typeof useColors>; onJobPress: (id: string) => void; propertyId?: string }) {
  const { data: jobs } = useListMarketplaceJobs();
  const activeJobs = (jobs ?? []).filter(
    (j: MarketplaceJob) =>
      (!propertyId || (j as any).propertyId === propertyId) &&
      (j.status === "open" ||
      j.status === "claimed" ||
      (j.status as string) === "en_route" ||
      (j.status as string) === "arrived")
  );
  if (!activeJobs.length) return null;

  return (
    <View style={activeStyles.wrap}>
      {/* Header */}
      <View style={activeStyles.header}>
        <View style={activeStyles.headerLeft}>
          <View style={[activeStyles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="tool" size={13} color={colors.primary} />
          </View>
          <Text style={[activeStyles.headerTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Active Service Requests
          </Text>
          <View style={[activeStyles.countBadge, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[activeStyles.countText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
              {activeJobs.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Horizontal card scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 20 }}
        style={{ marginLeft: -20, paddingLeft: 20 }}
      >
        {activeJobs.map((job: MarketplaceJob) => {
          const urgency = job.urgency ?? "medium";
          const accentColor = URGENCY_BORDER[urgency] ?? "#d97706";
          const iconName = URGENCY_ICON[urgency] ?? "clock";
          const jobStatus = job.status as string;
          const scheduledAt = (job as any).scheduledAt;

          const STATUS_LABEL: Record<string, string> = {
            open:     "Awaiting Pro",
            claimed:  "Pro Assigned",
            en_route: "On the Way",
            arrived:  "Arrived",
          };
          const STATUS_BG: Record<string, string> = {
            open:     colors.muted,
            claimed:  colors.primary + "18",
            en_route: "#3b82f620",
            arrived:  "#10b98120",
          };
          const STATUS_COLOR: Record<string, string> = {
            open:     colors.mutedForeground,
            claimed:  colors.primary,
            en_route: "#3b82f6",
            arrived:  "#10b981",
          };

          return (
            <TouchableOpacity
              key={job.id}
              activeOpacity={0.72}
              onPress={() => { Haptics.selectionAsync(); onJobPress(job.id); }}
              style={[
                activeStyles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderLeftColor: accentColor,
                },
              ]}
            >
              {/* Top row: icon + asset name + badge */}
              <View style={activeStyles.cardTop}>
                <Feather name={iconName} size={13} color={accentColor} />
                <Text
                  style={[activeStyles.assetName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
                  numberOfLines={1}
                >
                  {job.assetName}
                </Text>
                <View style={[
                  activeStyles.statusBadge,
                  { backgroundColor: STATUS_BG[jobStatus] ?? colors.muted },
                ]}>
                  <Text style={[
                    activeStyles.statusText,
                    { color: STATUS_COLOR[jobStatus] ?? colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                  ]}>
                    {STATUS_LABEL[jobStatus] ?? jobStatus}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text
                style={[activeStyles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                numberOfLines={2}
              >
                {job.description}
              </Text>

              {/* Scheduled row (once a pro is assigned) */}
              {jobStatus !== "open" && (
                <View style={activeStyles.scheduleRow}>
                  <Feather name="calendar" size={11} color={colors.mutedForeground} />
                  {scheduledAt ? (
                    <Text style={[activeStyles.scheduleText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {format(new Date(scheduledAt), "MMM d 'at' h:mm a")}
                    </Text>
                  ) : (
                    <Text style={[activeStyles.scheduleText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Service date pending
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const activeStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 14 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  countText: { fontSize: 11 },
  card: {
    width: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    gap: 6,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  assetName: { flex: 1, fontSize: 12 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  statusText: { fontSize: 10 },
  desc: { fontSize: 12, lineHeight: 17 },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  scheduleText: { fontSize: 11 },
});

// ── Health Score Widget (matches web's HealthScoreWidget) ─────────────────────
function HealthScoreWidget({ score, grade, overdueCount }: { score: number; grade: Grade; overdueCount: number }) {
  const cfg = GRADE_CONFIG[grade];
  const radius = 26, stroke = 5;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  return (
    <View style={[hStyles.wrap, { borderColor: cfg.color + "44", backgroundColor: "rgba(255,255,255,0.9)" }]}>
      {/* SVG ring */}
      <View style={hStyles.ringWrap}>
        <Svg width={66} height={66} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={33} cy={33} r={radius} fill="none" stroke={cfg.bg} strokeWidth={stroke} />
          <Circle
            cx={33} cy={33} r={radius} fill="none"
            stroke={cfg.color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={hStyles.ringCenter}>
            <Text style={[hStyles.score, { color: cfg.color, fontFamily: "Inter_700Bold" }]}>{score}</Text>
            <Text style={[hStyles.scoreLabel, { color: "#9CA3AF", fontFamily: "Inter_400Regular" }]}>/100</Text>
          </View>
        </View>
      </View>

      {/* Grade info */}
      <View style={hStyles.info}>
        <View style={hStyles.gradeRow}>
          <Text style={[hStyles.gradeText, { color: cfg.color, fontFamily: "Inter_700Bold" }]}>Grade {grade}</Text>
          <View style={[hStyles.gradePill, { backgroundColor: cfg.bg }]}>
            <Text style={[hStyles.gradePillText, { color: cfg.color, fontFamily: "Inter_700Bold" }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={[hStyles.ctaText, { color: "#6B7A8E", fontFamily: "Inter_400Regular" }]}>{cfg.cta}</Text>
        {overdueCount > 0 && (
          <View style={hStyles.overdueRow}>
            <Feather name="trending-up" size={11} color={cfg.color} />
            <Text style={[hStyles.overdueText, { color: cfg.color, fontFamily: "Inter_600SemiBold" }]}>
              See improvement plan
            </Text>
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={16} color="#9CA3AF" />
    </View>
  );
}

const hStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  ringWrap: { width: 66, height: 66, position: "relative" },
  ringCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 0 },
  score: { fontSize: 18, lineHeight: 20 },
  scoreLabel: { fontSize: 9 },
  info: { flex: 1, gap: 3 },
  gradeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  gradeText: { fontSize: 13 },
  gradePill: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  gradePillText: { fontSize: 10 },
  ctaText: { fontSize: 11 },
  overdueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  overdueText: { fontSize: 11 },
});

// ── Minimal inline SVG components ─────────────────────────────────────────────
function Svg({ width, height, style, children }: any) {
  const { Svg: RNSvg } = require("react-native-svg");
  return <RNSvg width={width} height={height} style={style}>{children}</RNSvg>;
}
function Circle(props: any) {
  const { Circle: RNCircle } = require("react-native-svg");
  return <RNCircle {...props} />;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  title, value, icon, valueColor, sub, colors,
}: {
  title: string; value: string | number; icon: keyof typeof Feather.glyphMap;
  valueColor?: string; sub?: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={statStyles.header}>
        <Text style={[statStyles.title, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{title}</Text>
        <Feather name={icon} size={14} color={colors.mutedForeground} />
      </View>
      <Text style={[statStyles.value, { color: valueColor ?? colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {value}
      </Text>
      {sub ? (
        <Text style={[statStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sub}</Text>
      ) : null}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 11, lineHeight: 14 },
  value: { fontSize: 24 },
  sub: { fontSize: 11, marginTop: 2 },
});

// ── Investment Ledger Card ────────────────────────────────────────────────────
function LedgerCard({ colors, onPress }: { colors: ReturnType<typeof useColors>; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[ledgerStyles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={ledgerStyles.top}>
        <View style={[ledgerStyles.iconBox, { backgroundColor: colors.primary + "1A" }]}>
          <Feather name="file-text" size={18} color={colors.primary} />
        </View>
        <View style={ledgerStyles.topText}>
          <Text style={[ledgerStyles.topTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Investment Ledger
          </Text>
          <Text style={[ledgerStyles.topSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Spending by category · expected vs actual
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
      <View style={[ledgerStyles.footer, { borderTopColor: colors.border, backgroundColor: colors.muted + "33" }]}>
        {[
          { icon: "dollar-sign" as const, label: "Track spend", sub: "by system" },
          { icon: "trending-up" as const, label: "Compare", sub: "est. vs actual" },
          { icon: "file-text" as const, label: "Full ledger", sub: "all records" },
        ].map(({ icon, label, sub }) => (
          <View key={label} style={[ledgerStyles.cell, { borderLeftColor: colors.border }]}>
            <Feather name={icon} size={12} color={colors.primary} />
            <Text style={[ledgerStyles.cellLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
            <Text style={[ledgerStyles.cellSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sub}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const ledgerStyles = StyleSheet.create({
  wrap: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  topText: { flex: 1, gap: 2 },
  topTitle: { fontSize: 14 },
  topSub: { fontSize: 11 },
  footer: { flexDirection: "row", borderTopWidth: 1 },
  cell: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 12, paddingHorizontal: 8, borderLeftWidth: StyleSheet.hairlineWidth },
  cellLabel: { fontSize: 11 },
  cellSub: { fontSize: 10 },
});

// ── Recent Activity Row ────────────────────────────────────────────────────────
function ActivityRow({
  description, assetName, companyName, date, colors,
}: {
  description: string; assetName?: string; companyName?: string; date: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[actStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[actStyles.icon, { backgroundColor: colors.muted }]}>
        <Feather name="file-text" size={13} color={colors.primary} />
      </View>
      <View style={actStyles.content}>
        <Text style={[actStyles.desc, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={2}>
          {description}
        </Text>
        <View style={actStyles.metaRow}>
          {assetName ? (
            <Text style={[actStyles.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {assetName} · 
            </Text>
          ) : null}
          {companyName === "CasaService" ? (
            <CasaServiceBadge />
          ) : (
            <Text style={[actStyles.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {companyName ?? "Service"}
            </Text>
          )}
          <Text style={[actStyles.meta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {" · "}{format(new Date(date), "MMM d, yyyy")}
          </Text>
        </View>
      </View>
    </View>
  );
}

const actStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 2 },
  content: { flex: 1, gap: 3 },
  desc: { fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 },
  meta: { fontSize: 11 },
});

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[secStyles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
      {title}
    </Text>
  );
}
const secStyles = StyleSheet.create({ title: { fontSize: 14, marginBottom: 10 } });

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ height, width, borderRadius, colors }: {
  height: number; width?: number | string; borderRadius?: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{
      height, width: (width ?? "100%") as any,
      borderRadius: borderRadius ?? 8,
      backgroundColor: colors.muted,
    }} />
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);

  const { data: properties = [], isLoading: propsLoading } = useListProperties();
  const selectedProperty = properties[selectedIdx];

  const { data: summary, isLoading: summaryLoading } = useGetPropertySummary(
    selectedProperty?.id ?? "",
    { query: { enabled: !!selectedProperty?.id, queryKey: ["property-summary", selectedProperty?.id] } }
  );

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      queryClient.invalidateQueries(),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isLoading = propsLoading;

  // Extract data
  const s = summary as any;
  const healthScore: number = s?.healthScore ?? 0;
  const healthGrade: Grade = (s?.healthGrade as Grade) ?? "C";
  const totalAssets: number = s?.totalAssets ?? 0;
  const verifiedAssets: number = s?.verifiedAssets ?? 0;
  const overdueCount: number = s?.overdueTaskCount ?? 0;
  const assetsByCategory: { category: string; count: number }[] = s?.assetsByCategory ?? [];
  const recentRecords: any[] = s?.recentRecords ?? [];
  const overdueTasks: any[] = s?.overdueTasks ?? [];
  const assetScores: any[] = s?.assetScores ?? [];
  const location = selectedProperty
    ? [selectedProperty.city, selectedProperty.state].filter(Boolean).join(", ")
    : "";
  const sp = selectedProperty as any;
  const bedrooms = sp?.bedrooms;
  const bathrooms = sp?.bathrooms;
  const sqft = sp?.sqft;

  if (isLoading) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: topPad + 20, paddingHorizontal: 20, gap: 16 }]}>
        <Skeleton height={28} width="60%" colors={colors} />
        <Skeleton height={90} borderRadius={12} colors={colors} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Skeleton height={80} width="31%" borderRadius={12} colors={colors} />
          <Skeleton height={80} width="31%" borderRadius={12} colors={colors} />
          <Skeleton height={80} width="31%" borderRadius={12} colors={colors} />
        </View>
        <Skeleton height={100} borderRadius={12} colors={colors} />
      </View>
    );
  }

  if (properties.length === 0) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }]}>
        <View style={[{ backgroundColor: colors.muted, borderRadius: 20, padding: 24, marginBottom: 20 }]}>
          <Feather name="home" size={48} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
        </View>
        <Text style={{ fontSize: 20, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>
          No property selected
        </Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular" }}>
          Add your home in the web app to start tracking health scores, assets, and maintenance.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <HealthScoreModal
      visible={healthModalOpen}
      onClose={() => setHealthModalOpen(false)}
      healthScore={healthScore}
      healthGrade={healthGrade}
      overdueTaskCount={overdueCount}
      overdueTasks={overdueTasks}
      assetScores={assetScores}
      propertyId={selectedProperty?.id ?? ""}
    />
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingTop: topPad + 8, paddingHorizontal: 20 }}>

        {/* Property selector chips */}
        {properties.length > 1 && (
          <FlatList
            horizontal
            data={properties}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[chipStyles.chip, {
                  backgroundColor: index === selectedIdx ? colors.primary : colors.card,
                  borderColor: index === selectedIdx ? colors.primary : colors.border,
                }]}
                onPress={() => { setSelectedIdx(index); Haptics.selectionAsync(); }}
              >
                <Feather name="home" size={12} color={index === selectedIdx ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[chipStyles.chipText, {
                  color: index === selectedIdx ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                }]} numberOfLines={1}>
                  {item.name ?? item.address ?? "Property"}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Property header */}
        <View style={{ marginBottom: 14, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[propStyles.name, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1 }]} numberOfLines={1}>
              {(selectedProperty as any)?.name ?? (selectedProperty as any)?.address ?? "My Home"}
            </Text>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); router.push("/properties"); }}
              style={[propStyles.viewAllBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              activeOpacity={0.7}
            >
              <Text style={[propStyles.viewAllText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                All Properties
              </Text>
              <Feather name="chevron-right" size={12} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {location ? (
            <View style={propStyles.row}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[propStyles.location, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {location}
              </Text>
            </View>
          ) : null}
          {(bedrooms || bathrooms || sqft) ? (
            <View style={propStyles.row}>
              {bedrooms ? (
                <View style={propStyles.specItem}>
                  <Feather name="layout" size={12} color={colors.mutedForeground} />
                  <Text style={[propStyles.spec, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {bedrooms} bd
                  </Text>
                </View>
              ) : null}
              {bathrooms ? (
                <View style={propStyles.specItem}>
                  <Feather name="droplet" size={12} color={colors.mutedForeground} />
                  <Text style={[propStyles.spec, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {bathrooms} ba
                  </Text>
                </View>
              ) : null}
              {sqft ? (
                <View style={propStyles.specItem}>
                  <Feather name="maximize" size={12} color={colors.mutedForeground} />
                  <Text style={[propStyles.spec, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {Number(sqft).toLocaleString()} sqft
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Active service requests */}
        <ActiveServiceRequests
          colors={colors}
          onJobPress={(id) => router.push(`/job/${id}`)}
          propertyId={selectedProperty?.id}
        />

        {/* Maintenance inbox */}
        {selectedProperty && (
          <View style={{ marginBottom: 16 }}>
            <MaintenanceInbox
              propertyId={selectedProperty.id}
              insetBottom={insets.bottom}
            />
          </View>
        )}

        {/* Health score widget */}
        {summaryLoading ? (
          <Skeleton height={86} borderRadius={12} colors={colors} />
        ) : (
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setHealthModalOpen(true); }}
            activeOpacity={0.88}
          >
            <HealthScoreWidget score={healthScore} grade={healthGrade} overdueCount={overdueCount} />
          </TouchableOpacity>
        )}

        {/* 3 stat cards */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <StatCard
            title={"Tracked\nAssets"}
            value={totalAssets}
            icon="package"
            sub={`${verifiedAssets} of ${totalAssets} verified`}
            colors={colors}
          />
          <StatCard
            title={"Overdue\nTasks"}
            value={overdueCount}
            icon="alert-circle"
            valueColor={overdueCount > 0 ? colors.destructive : colors.foreground}
            sub={overdueCount > 0 ? "See improvement plan" : "All clear"}
            colors={colors}
          />
          <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={statStyles.header}>
              <Text style={[statStyles.title, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {"By\nSystem"}
              </Text>
            </View>
            {assetsByCategory.slice(0, 2).map((cat) => (
              <View key={cat.category} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
                  {cat.category} {cat.count}
                </Text>
              </View>
            ))}
            {assetsByCategory.length === 0 && (
              <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                —
              </Text>
            )}
          </View>
        </View>

        {/* Investment Ledger card */}
        <View style={{ marginBottom: 20 }}>
          <LedgerCard
            colors={colors}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/investment-ledger");
            }}
          />
        </View>

        {/* Recent Service Activity */}
        {recentRecords.length > 0 && (
          <View style={[sectionStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionHeader title="Recent Service Activity" colors={colors} />
            {recentRecords.slice(0, 5).map((record: any) => (
              <ActivityRow
                key={record.id}
                description={record.description}
                assetName={record.assetName}
                companyName={record.companyName ?? record.technicianName}
                date={record.date}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* No activity empty state */}
        {!summaryLoading && recentRecords.length === 0 && (
          <View style={[sectionStyles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", paddingVertical: 32 }]}>
            <Feather name="file-text" size={36} color={colors.mutedForeground} style={{ opacity: 0.25, marginBottom: 10 }} />
            <Text style={{ fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" }}>
              No service records yet
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4, maxWidth: 220 }}>
              Service history will appear here as you log work done on your home's systems.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
});

const propStyles = StyleSheet.create({
  name: { fontSize: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  location: { fontSize: 13 },
  specItem: { flexDirection: "row", alignItems: "center", gap: 3, marginRight: 10 },
  spec: { fontSize: 12 },
  viewAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1,
  },
  viewAllText: { fontSize: 12 },
});

const sectionStyles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
});
