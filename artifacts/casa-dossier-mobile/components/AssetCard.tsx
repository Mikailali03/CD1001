import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getExpectedLifespan } from "@workspace/maintenance-specs";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";

// ── Category display config (colors and icons only) ──────────────────────────
// Lifespans come from @workspace/maintenance-specs so the app agrees with the server.
export const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  HVAC:       { emoji: "❄️",  color: "#3b82f6", bg: "#3b82f615" },
  Plumbing:   { emoji: "🔧",  color: "#06b6d4", bg: "#06b6d415" },
  Electrical: { emoji: "⚡",  color: "#eab308", bg: "#eab30815" },
  Roof:       { emoji: "🏠",  color: "#78716c", bg: "#78716c15" },
  Appliance:  { emoji: "🫙",  color: "#8b5cf6", bg: "#8b5cf615" },
  Structural: { emoji: "🏗️", color: "#22c55e", bg: "#22c55e15" },
  Other:      { emoji: "📦",  color: "#94a3b8", bg: "#94a3b815" },
};

// Category name normalisation (API may return lowercase or plural)
function normCategory(cat: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
    roof: "Roof", roofing: "Roof", appliance: "Appliance", appliances: "Appliance",
    structural: "Structural", other: "Other",
  };
  return map[cat?.toLowerCase()] ?? cat;
}

// ── Score calculation (matches web exactly) ───────────────────────────────────
export function calcAssetScore(asset: {
  /** Refines the lifespan for well-known equipment (e.g. "Water Heater") */
  name?: string;
  installDate?: string | null;
  warrantyExpiry?: string | null;
  status?: string;
  category: string;
}): number {
  const cat = normCategory(asset.category);
  const lifespan = getExpectedLifespan(cat, asset.name ?? "");
  let score = 100;
  if (asset.installDate) {
    const ageYears = (Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    score -= Math.round(Math.min(ageYears / lifespan, 1) * 40);
  }
  if (asset.status === "needs_attention") score -= 25;
  else if (asset.status === "unverified") score -= 5;
  if (asset.status === "verified") score = Math.min(score + 5, 100);
  if (asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date()) score = Math.min(score + 5, 100);
  return Math.max(0, Math.round(score));
}

export function gradeFromScore(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: "A", color: "#3d7a5f" };
  if (score >= 75) return { grade: "B", color: "#4b7fb5" };
  if (score >= 55) return { grade: "C", color: "#c8853a" };
  if (score >= 35) return { grade: "D", color: "#b85a2a" };
  return { grade: "F", color: "#c0392b" };
}

// ── Radial gauge (matches web's RadialGauge) ──────────────────────────────────
function RadialGauge({ score }: { score: number }) {
  const { grade, color } = gradeFromScore(score);
  const radius = 22, strokeW = 4;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  const { Svg, Circle } = require("react-native-svg");

  return (
    <View style={gaugeStyles.wrap}>
      <Svg width={56} height={56} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={28} cy={28} r={radius} fill="none" stroke={color + "33"} strokeWidth={strokeW} />
        <Circle
          cx={28} cy={28} r={radius} fill="none"
          stroke={color} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, gaugeStyles.center]}>
        <Text style={[gaugeStyles.grade, { color, fontFamily: "Inter_700Bold" }]}>{grade}</Text>
        <Text style={[gaugeStyles.score, { color: "#9CA3AF", fontFamily: "Inter_400Regular" }]}>{score}</Text>
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  wrap: { width: 56, height: 56, position: "relative" },
  center: { alignItems: "center", justifyContent: "center" },
  grade: { fontSize: 14, lineHeight: 16 },
  score: { fontSize: 9 },
});

// ── Asset Card ────────────────────────────────────────────────────────────────
export interface AssetCardProps {
  id?: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installDate?: string | null;
  warrantyExpiry?: string | null;
  status?: string;
  condition?: string;
  lastServiceDate?: string | null;
  onPress?: () => void;
}

export function AssetCard({ name, category, brand, model, serialNumber, installDate, warrantyExpiry, status, onPress }: AssetCardProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const cat = normCategory(category);
  const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.Other!;
  const score = calcAssetScore({ name, installDate, warrantyExpiry, status, category: cat });
  const underWarranty = warrantyExpiry ? new Date(warrantyExpiry) > new Date() : false;
  const needsAttention = status === "needs_attention";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: cfg.color + "30" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Category emoji icon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Text style={styles.emoji}>{cfg.emoji}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {(brand || model) && (
          <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
            {[brand, model].filter(Boolean).join(" · ")}
          </Text>
        )}
        {serialNumber && (
          <Text style={[styles.serial, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
            {t("assetCard.serial", { serial: serialNumber })}
          </Text>
        )}
        {/* Badges */}
        <View style={styles.badges}>
          {underWarranty && (
            <View style={styles.warrantyBadge}>
              <Feather name="shield" size={9} color="#059669" />
              <Text style={styles.warrantyText}>{t("assetCard.warranty")}</Text>
            </View>
          )}
          {needsAttention && (
            <View style={styles.attentionBadge}>
              <Text style={styles.attentionText}>{t("assetCard.needsAttention")}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Radial gauge + chevron */}
      <View style={styles.right}>
        <RadialGauge score={score} />
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 22, lineHeight: 26 },
  content: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 14, lineHeight: 18 },
  sub: { fontSize: 12 },
  serial: { fontSize: 10, fontFamily: "monospace" },
  badges: { flexDirection: "row", gap: 4, marginTop: 2, flexWrap: "wrap" },
  warrantyBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#d1fae5", borderWidth: 1, borderColor: "#6ee7b7",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  warrantyText: { fontSize: 9, color: "#059669", fontFamily: "Inter_700Bold" },
  attentionBadge: {
    backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fca5a5",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  attentionText: { fontSize: 9, color: "#dc2626", fontFamily: "Inter_700Bold" },
  right: { flexDirection: "row", alignItems: "center", gap: 2 },
});
