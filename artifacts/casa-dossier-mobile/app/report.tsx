import React, { useState, useEffect } from "react";
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
import { useAuth } from "@clerk/expo";
import { useListProperties } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { format, parseISO } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────
type ServiceRecord = {
  id: string;
  date: string;
  description: string;
  technicianName: string | null;
  companyName: string | null;
  cost: number | null;
};

type ReportAsset = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  status: string;
  retiredAt: string | null;
  notes: string | null;
  records: ServiceRecord[];
};

type ReportData = {
  property: {
    name: string;
    address: string;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    yearBuilt: number | null;
    sqft: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
  };
  activeAssets: ReportAsset[];
  retiredAssets: ReportAsset[];
  totalEvents: number;
  generatedAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function performer(r: ServiceRecord) {
  if (r.companyName === "CasaService") return `✦ CasaService${r.technicianName ? ` — ${r.technicianName}` : ""}`;
  return r.companyName ?? r.technicianName ?? "Homeowner (DIY)";
}

// ── Asset Card ─────────────────────────────────────────────────────────────────
function AssetCard({ asset, retired, colors }: {
  asset: ReportAsset; retired?: boolean; colors: ReturnType<typeof useColors>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[assetStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} activeOpacity={0.7} style={assetStyles.header}>
        <View style={assetStyles.headerLeft}>
          <Text style={[assetStyles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {asset.name}
          </Text>
          <Text style={[assetStyles.cat, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {asset.category}
            {asset.brand ? ` · ${asset.brand}` : ""}
            {asset.model ? ` ${asset.model}` : ""}
          </Text>
          {retired && asset.retiredAt && (
            <Text style={[assetStyles.retired, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Decommissioned {fmtDate(asset.retiredAt)}
            </Text>
          )}
        </View>
        <View style={assetStyles.headerRight}>
          {asset.records.length > 0 && (
            <View style={[assetStyles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[assetStyles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {asset.records.length} event{asset.records.length !== 1 ? "s" : ""}
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
            {asset.serialNumber && <Spec label="Serial" value={asset.serialNumber} colors={colors} />}
            {asset.installDate && <Spec label="Installed" value={fmtDate(asset.installDate)} colors={colors} />}
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
                    {performer(r)}
                    {r.cost != null && r.cost > 0 ? ` · $${Number(r.cost).toLocaleString()}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {asset.records.length === 0 && (
            <Text style={[assetStyles.noRecords, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No service records
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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: properties = [] } = useListProperties();
  const propertyId = (properties[0] as any)?.id as string | undefined;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${baseUrl}/api/properties/${propertyId}/report`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [propertyId, baseUrl]);

  async function handleShare() {
    if (!data) return;
    const p = data.property;
    const lines = [
      `📋 Property Dossier — ${p.name}`,
      `${p.address}${p.city ? `, ${p.city}` : ""}${p.state ? `, ${p.state}` : ""}`,
      p.yearBuilt ? `Built: ${p.yearBuilt}` : null,
      p.sqft ? `${p.sqft.toLocaleString()} sqft` : null,
      "",
      `Assets: ${data.activeAssets.length} active, ${data.retiredAssets.length} retired`,
      `Audited events: ${data.totalEvents}`,
      "",
      `Generated ${format(parseISO(data.generatedAt), "MMM d, yyyy")} via Casa Dossier`,
    ].filter(Boolean).join("\n");
    await Share.share({ message: lines });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[hdrStyles.bar, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={hdrStyles.back} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[hdrStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Property Report
        </Text>
        <TouchableOpacity onPress={handleShare} style={hdrStyles.share} hitSlop={10} disabled={!data}>
          <Feather name="share" size={20} color={data ? colors.foreground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular", fontSize: 13 }]}>
            Generating report…
          </Text>
        </View>
      )}

      {error && !loading && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
          <Text style={[{ color: colors.foreground, marginTop: 12, fontFamily: "Inter_600SemiBold", fontSize: 15 }]}>
            Could not load report
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
              {data.property.yearBuilt && <StatChip label="Built" value={String(data.property.yearBuilt)} colors={colors} />}
              {data.property.sqft && <StatChip label="Sqft" value={data.property.sqft.toLocaleString()} colors={colors} />}
              {data.property.bedrooms && <StatChip label="Beds" value={String(data.property.bedrooms)} colors={colors} />}
              {data.property.bathrooms && <StatChip label="Baths" value={String(data.property.bathrooms)} colors={colors} />}
            </View>
            <View style={[propStyles.divider, { borderTopColor: colors.border }]} />
            <View style={propStyles.eventsRow}>
              <View style={propStyles.eventsItem}>
                <Text style={[propStyles.eventsNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {data.activeAssets.length + data.retiredAssets.length}
                </Text>
                <Text style={[propStyles.eventsLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Total Assets
                </Text>
              </View>
              <View style={propStyles.eventsItem}>
                <Text style={[propStyles.eventsNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {data.totalEvents}
                </Text>
                <Text style={[propStyles.eventsLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Audited Events
                </Text>
              </View>
              <View style={propStyles.eventsItem}>
                <Text style={[propStyles.eventsNum, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {format(parseISO(data.generatedAt), "MMM d")}
                </Text>
                <Text style={[propStyles.eventsLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Generated
                </Text>
              </View>
            </View>
          </View>

          {/* Active assets */}
          {data.activeAssets.length > 0 && (
            <>
              <Text style={[sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                ACTIVE ASSETS ({data.activeAssets.length})
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
                RETIRED ASSETS ({data.retiredAssets.length})
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
                No assets tracked yet
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
