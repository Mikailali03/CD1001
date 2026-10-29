import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { getExpectedLifespan } from "@workspace/maintenance-specs";
import { normCategory } from "./utils";

// ── Life-used bar ──────────────────────────────────────────────────────────────
export function LifeBar({ installDate, category, name, colors }: { installDate?: string | null; category: string; name?: string; colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  if (!installDate) return null;
  const cat = normCategory(category);
  const lifespan = getExpectedLifespan(cat, name ?? "");
  const ageYears = (Date.now() - new Date(installDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  const pct = Math.min(Math.round((ageYears / lifespan) * 100), 100);
  const barColor = pct >= 80 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";

  return (
    <View style={lifeStyles.wrap}>
      <View style={lifeStyles.row}>
        <Text style={[lifeStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("assetDetail.lifeUsed")}</Text>
        <Text style={[lifeStyles.pct, { color: barColor, fontFamily: "Inter_700Bold" }]}>{pct}%</Text>
      </View>
      <View style={[lifeStyles.track, { backgroundColor: colors.muted }]}>
        <View style={[lifeStyles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[lifeStyles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {t("assetDetail.lifeSummary", { age: Math.round(ageYears), lifespan })}
      </Text>
    </View>
  );
}

const lifeStyles = StyleSheet.create({
  wrap: { gap: 5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 12 },
  pct: { fontSize: 12 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  sub: { fontSize: 10 },
});
