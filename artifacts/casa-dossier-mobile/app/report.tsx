import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  getGetPropertyReportQueryKey,
  useGetPropertyReport,
  type PropertyReport,
  type ReportAsset,
  type ServiceRecord,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSelectedProperty } from "@/context/PropertyContext";
import { EmptyState } from "@/components/EmptyState";
import { parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { formatDate } from "@/lib/dates";

// ── Types ──────────────────────────────────────────────────────────────────────
type ReportData = PropertyReport;

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return formatDate(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function performer(r: ServiceRecord, t: TFunction) {
  if (r.companyName === "CasaService") {
    return r.technicianName ? t("report.casaServiceWithTech", { name: r.technicianName }) : t("report.casaService");
  }
  return r.companyName ?? r.technicianName ?? t("report.homeownerDiy");
}

// ── Asset Card ─────────────────────────────────────────────────────────────────
function AssetCard({ asset, retired, colors }: {
  asset: ReportAsset; retired?: boolean; colors: ReturnType<typeof useColors>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={[assetStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} activeOpacity={0.7} style={assetStyles.header}>
        <View style={assetStyles.headerLeft}>
          <Text style={[assetStyles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {asset.name}
          </Text>
          <Text style={[assetStyles.cat, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t(`categories.${asset.category}`, { defaultValue: asset.category })}
            {asset.brand ? ` · ${asset.brand}` : ""}
            {asset.model ? ` ${asset.model}` : ""}
          </Text>
          {retired && asset.retiredAt && (
            <Text style={[assetStyles.retired, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("report.decommissioned", { date: fmtDate(asset.retiredAt) })}
            </Text>
          )}
        </View>
        <View style={assetStyles.headerRight}>
          {asset.records.length > 0 && (
            <View style={[assetStyles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[assetStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {t("report.eventCount", { count: asset.records.length })}
              </Text>
            </View>
          )}
          <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      {open && (
        <View style={[assetStyles.body, { borderTopColor: colors.border }]}>
          {/* Specs row */}
          <View style={assetStyles.specs}>
            {asset.serialNumber && <Spec label={t("report.serial")} value={asset.serialNumber} colors={colors} />}
            {asset.installDate && <Spec label={t("report.installed")} value={fmtDate(asset.installDate)} colors={colors} />}
          </View>
          {asset.notes && (
            <Text style={[assetStyles.notes, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {asset.notes}
            </Text>
          )}

          {/* Records */}
          {asset.records.length > 0 && (
            <View style={assetStyles.records}>
              {asset.records.map((r) => (
                <View key={r.id} style={[assetStyles.record, { borderLeftColor: colors.primary + "55" }]}>
                  <Text style={[assetStyles.recDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {fmtDate(r.date)}
                  </Text>
                  <Text style={[assetStyles.recDesc, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                    {r.description}
                  </Text>
                  <Text style={[assetStyles.recPerf, {
                    color: r.companyName === "CasaService" ? "#92400e" : colors.mutedForeground,
                    fontFamily: r.companyName === "CasaService" ? "Inter_600SemiBold" : "Inter_400Regular",
                  }]}>
                    {performer(r, t)}
                    {r.cost != null && Number(r.cost) > 0 ? ` · $${Number(r.cost).toLocaleString()}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {asset.records.length === 0 && (
            <Text style={[assetStyles.noRecords, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("report.noRecords")}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function Spec({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={assetStyles.specItem}>
      <Text style={[assetStyles.specLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <Text style={[assetStyles.specValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{value}</Text>
    </View>
  );
}

const assetStyles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 10 },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  name: { fontSize: 14 },
  cat: { fontSize: 12, marginTop: 2 },
  retired: { fontSize: 11, marginTop: 2, fontStyle: "italic" },
  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11 },
  body: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10 },
  specs: { flexDirection: "row", gap: 20, marginBottom: 8 },
  specItem: { gap: 1 },
  specLabel: { fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" },
  specValue: { fontSize: 12 },
  notes: { fontSize: 12, marginBottom: 10, lineHeight: 17 },
  records: { gap: 8 },
  record: { borderLeftWidth: 2, paddingLeft: 10, gap: 2 },
  recDate: { fontSize: 11 },
  recDesc: { fontSize: 12, lineHeight: 17 },
  recPerf: { fontSize: 11 },
  noRecords: { fontSize: 12, fontStyle: "italic" },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ReportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { selectedProperty, isLoading: propsLoading } = useSelectedProperty();
  const propertyId = selectedProperty?.id;
  // No properties at all: show the empty state instead of waiting forever for a propertyId
  const noProperty = !propsLoading && !propertyId;

  const report = useGetPropertyReport(propertyId ?? "", {
    query: { queryKey: getGetPropertyReportQueryKey(propertyId ?? ""), enabled: !!propertyId },
  });
  const data: ReportData | undefined = report.data;
  const loading = report.isPending;
  const error = report.isError;

  async function handleShare() {
    if (!data) return;
    const p = data.property;
    const lines = [
      t("report.share.title", { name: p.name }),
      [p.address, p.city, p.state].filter(Boolean).join(", "),
      p.yearBuilt ? t("report.share.built", { year: p.yearBuilt }) : null,
      p.sqft ? t("report.share.sqft", { sqft: p.sqft.toLocaleString() }) : null,
      "",
      t("report.share.assets", { active: data.activeAssets.length, retired: data.retiredAssets.length }),
      t("report.share.events", { count: data.totalEvents }),
      "",
      t("report.share.generated", { date: formatDate(parseISO(data.generatedAt), "MMM d, yyyy") }),
    ].filter(Boolean).join("\n");
    await Share.share({ message: lines });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[hdrStyles.bar, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.goBack")} onPress={() => router.back()} style={hdrStyles.back} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[hdrStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("report.title")}
        </Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("report.shareLabel")} onPress={handleShare} style={hdrStyles.share} hitSlop={10} disabled={!data}>
          <Feather name="share" size={20} color={data ? colors.foreground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {noProperty && (
        <EmptyState
          icon="home"
          title={t("common.noPropertyYet")}
          description={t("report.noPropertyDesc")}
          actionLabel={t("common.addAProperty")}
          onAction={() => router.push("/properties")}
        />
      )}

      {loading && !noProperty && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
            {t("report.generating")}
          </Text>
        </View>
      )}

      {error && !loading && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
          <Text style={[{ color: colors.foreground, marginTop: 12, fontFamily: "Inter_600SemiBold", fontSize: 15 }]}>
            {t("report.loadFailed")}
          </Text>
        </View>
      )}

      {!loading && !error && data && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Property summary */}
          <View style={[propStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[propStyles.name, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {data.property.name}
            </Text>
            <Text style={[propStyles.address, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {data.property.address}
              {data.property.city ? `, ${data.property.city}` : ""}
              {data.property.state ? `, ${data.property.state}` : ""}
              {data.property.zipCode ? ` ${data.property.zipCode}` : ""}
            </Text>
            <View style={propStyles.stats}>
              {data.property.yearBuilt && <StatChip label={t("report.built")} value={String(data.property.yearBuilt)} colors={colors} />}
              {data.property.sqft && <StatChip label={t("report.sqftLabel")} value={data.property.sqft.toLocaleString()} colors={colors} />}
              {data.property.bedrooms && <StatChip label={t("report.beds")} value={String(data.property.bedrooms)} colors={colors} />}
              {data.property.bathrooms && <StatChip label={t("report.baths")} value={String(Number(data.property.bathrooms))} colors={colors} />}
            </View>
            <View style={[propStyles.divider, { borderTopColor: colors.border }]} />
            <View style={propStyles.eventsRow}>
              <View style={propStyles.eventsItem}>
                <Text style={[propStyles.eventsNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {data.activeAssets.length + data.retiredAssets.length}
                </Text>
                <Text style={[propStyles.eventsLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("report.totalAssets")}
                </Text>
              </View>
              <View style={propStyles.eventsItem}>
                <Text style={[propStyles.eventsNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {data.totalEvents}
                </Text>
                <Text style={[propStyles.eventsLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("report.auditedEvents")}
                </Text>
              </View>
              <View style={propStyles.eventsItem}>
                <Text style={[propStyles.eventsNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {formatDate(parseISO(data.generatedAt), "MMM d")}
                </Text>
                <Text style={[propStyles.eventsLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("report.generated")}
                </Text>
              </View>
            </View>
          </View>

          {/* Active assets */}
          {data.activeAssets.length > 0 && (
            <>
              <Text style={[sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {t("report.activeAssets", { count: data.activeAssets.length })}
              </Text>
              {data.activeAssets.map((a) => (
                <AssetCard key={a.id} asset={a} colors={colors} />
              ))}
            </>
          )}

          {/* Retired assets */}
          {data.retiredAssets.length > 0 && (
            <>
              <Text style={[sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 20 }]}>
                {t("report.retiredAssets", { count: data.retiredAssets.length })}
              </Text>
              {data.retiredAssets.map((a) => (
                <AssetCard key={a.id} asset={a} retired colors={colors} />
              ))}
            </>
          )}

          {data.activeAssets.length === 0 && data.retiredAssets.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <Feather name="package" size={36} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                {t("report.noAssets")}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StatChip({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[chipStyles.chip, { backgroundColor: colors.muted }]}>
      <Text style={[chipStyles.val, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{value}</Text>
      <Text style={[chipStyles.lab, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
    </View>
  );
}
const chipStyles = StyleSheet.create({
  chip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  val: { fontSize: 15 },
  lab: { fontSize: 10, marginTop: 1 },
});

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
  share: { padding: 4, marginLeft: 8 },
});

const propStyles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 20, marginBottom: 4 },
  name: { fontSize: 18 },
  address: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  stats: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, marginBottom: 14 },
  eventsRow: { flexDirection: "row", justifyContent: "space-around" },
  eventsItem: { alignItems: "center", gap: 2 },
  eventsNum: { fontSize: 20 },
  eventsLabel: { fontSize: 11 },
});

const sectionLabel: object = {
  fontSize: 11, letterSpacing: 0.8, marginTop: 24, marginBottom: 10,
};
