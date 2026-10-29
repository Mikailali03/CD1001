import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
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
import { useListAssets, getListAssetsQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSelectedProperty } from "@/context/PropertyContext";
import { AssetCard, CATEGORY_CONFIG, calcAssetScore } from "@/components/AssetCard";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

const CATEGORY_ORDER = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"];

function normCategory(cat: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
    roof: "Roof", roofing: "Roof", appliance: "Appliance", appliances: "Appliance",
    structural: "Structural", other: "Other",
  };
  return map[cat?.toLowerCase()] ?? cat;
}

type RawAsset = {
  id: string;
  propertyId?: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installDate?: string | null;
  warrantyExpiry?: string | null;
  replacementCost?: string | null;
  status?: string;
  notes?: string | null;
  condition?: string;
  lastServiceDate?: string | null;
};

function isUnderWarranty(warrantyExpiry?: string | null): boolean {
  if (!warrantyExpiry) return false;
  return new Date(warrantyExpiry) > new Date();
}

// ── Category section header (matches web) ─────────────────────────────────────
function CategoryHeader({
  category, count, colors,
}: { category: string; count: number; colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Other!;
  return (
    <View style={catStyles.wrap}>
      <Text style={catStyles.emoji}>{cfg.emoji}</Text>
      <Text style={[catStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
        {t(`categories.${category}`, { defaultValue: category }).toUpperCase()}
      </Text>
      <View style={[catStyles.divider, { backgroundColor: colors.border }]} />
      <Text style={[catStyles.count, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {count}
      </Text>
    </View>
  );
}

const catStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10, marginTop: 4 },
  emoji: { fontSize: 15 },
  label: { fontSize: 11, letterSpacing: 0.8 },
  divider: { flex: 1, height: 1 },
  count: { fontSize: 11 },
});

// ── Summary pill ──────────────────────────────────────────────────────────────
function SummaryPill({
  label, icon, bg, textColor,
}: { label: string; icon: keyof typeof Feather.glyphMap; bg: string; textColor: string }) {
  return (
    <View style={[pillStyles.pill, { backgroundColor: bg }]}>
      <Feather name={icon} size={12} color={textColor} />
      <Text style={[pillStyles.text, { color: textColor, fontFamily: "Inter_500Medium" }]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  text: { fontSize: 12 },
});

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 20, paddingHorizontal: 20, paddingTop: 20 }}>
      <View style={{ gap: 6 }}>
        <View style={{ height: 28, width: "50%", borderRadius: 8, backgroundColor: colors.muted }} />
        <View style={{ height: 14, width: "70%", borderRadius: 6, backgroundColor: colors.muted }} />
      </View>
      {[0, 1].map((g) => (
        <View key={g} style={{ gap: 10 }}>
          <View style={{ height: 14, width: "30%", borderRadius: 6, backgroundColor: colors.muted }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 72, borderRadius: 12, backgroundColor: colors.muted }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AssetsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const { selectedProperty: activeProperty, isLoading: propsLoading } = useSelectedProperty();
  const propertyId = activeProperty?.id ?? "";

  const { data: rawAssets = [], isLoading: assetsLoading } = useListAssets(
    propertyId,
    {},
    { query: { queryKey: getListAssetsQueryKey(propertyId, {}), enabled: !!propertyId } }
  );

  const assets = rawAssets as RawAsset[];
  const isLoading = propsLoading || assetsLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey(propertyId) }),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Group by category (matches web logic)
  const grouped = CATEGORY_ORDER.reduce<Record<string, RawAsset[]>>((acc, cat) => {
    const items = assets.filter((a) => normCategory(a.category) === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  const otherCats = assets.filter((a) => !CATEGORY_ORDER.includes(normCategory(a.category)));
  if (otherCats.length > 0) grouped["Other"] = [...(grouped["Other"] ?? []), ...otherCats];

  const totalAssets = assets.length;
  const underWarrantyCount = assets.filter((a) => isUnderWarranty(a.warrantyExpiry)).length;
  const needsAttentionCount = assets.filter((a) => a.status === "needs_attention").length;

  const groupedEntries = Object.entries(grouped);

  const topPad2 = Platform.OS === "web" ? 67 : insets.top;

  if (!propertyId || isLoading) {
    return isLoading
      ? <View style={{ flex: 1, backgroundColor: colors.background }}><Skeleton colors={colors} /></View>
      : (
        <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: colors.muted, borderRadius: 20, padding: 24, marginBottom: 16 }}>
            <Feather name="package" size={40} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
          </View>
          <Text style={{ fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>
            {t("assets.noPropertyTitle")}
          </Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_400Regular" }}>
            {t("assets.noPropertyDesc")}
          </Text>
        </View>
      );
  }

  const listData: Array<{ type: "header"; category: string; count: number } | { type: "asset"; asset: RawAsset }> = [];
  for (const [category, items] of groupedEntries) {
    listData.push({ type: "header", category, count: items.length });
    for (const asset of items) {
      listData.push({ type: "asset", asset });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sticky header */}
      <View style={[headerStyles.wrap, { paddingTop: topPad2, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={headerStyles.row}>
          <View>
            <Text style={[headerStyles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{t("assets.title")}</Text>
            {activeProperty && (
              <Text style={[headerStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {activeProperty.name || activeProperty.address || t("common.myHome")}
              </Text>
            )}
          </View>
          {/* Add asset FAB */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("assets.addAsset")}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/add-asset", params: { propertyId } });
            }}
            style={[headerStyles.fab, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={22} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        {/* Summary pills */}
        {totalAssets > 0 && (
          <View style={headerStyles.pillsRow}>
            <SummaryPill label={t("assets.trackedCount", { count: totalAssets })} icon="package" bg={colors.muted} textColor={colors.foreground} />
            {underWarrantyCount > 0 && (
              <SummaryPill
                label={t("assets.underWarrantyCount", { count: underWarrantyCount })}
                icon="shield"
                bg="#d1fae5"
                textColor="#059669"
              />
            )}
            {needsAttentionCount > 0 && (
              <SummaryPill
                label={t("assets.needsAttentionCount", { count: needsAttentionCount })}
                icon="alert-circle"
                bg={colors.destructive + "18"}
                textColor={colors.destructive}
              />
            )}
          </View>
        )}
      </View>

      {/* Asset list grouped by category */}
      {groupedEntries.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: colors.muted, borderRadius: 20, padding: 20, marginBottom: 14 }}>
            <Feather name="package" size={36} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
          </View>
          <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{t("assets.noAssetsTitle")}</Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center", marginTop: 4, fontFamily: "Inter_400Regular" }}>
            {t("assets.noAssetsDesc")}
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/add-asset", params: { propertyId } });
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 18 }}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={{ fontSize: 14, color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>{t("assets.addFirst")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, idx) =>
            item.type === "header" ? `header-${item.category}` : `asset-${item.asset.id}`
          }
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <CategoryHeader
                  category={item.category}
                  count={item.count}
                  colors={colors}
                />
              );
            }
            return (
              <AssetCard
                id={item.asset.id}
                name={item.asset.name}
                category={item.asset.category}
                brand={item.asset.brand}
                model={item.asset.model}
                serialNumber={item.asset.serialNumber}
                installDate={item.asset.installDate}
                warrantyExpiry={item.asset.warrantyExpiry}
                status={item.asset.status}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/asset/${item.asset.id}`);
                }}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 28 },
  sub: { fontSize: 13, marginTop: 2 },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  fab: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 2 },
});
