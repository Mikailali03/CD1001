import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { fmt$ } from "./categoryColors";

// ── Compare Bar ────────────────────────────────────────────────────────────────
export function CompareBar({ actual, expected, colors }: { actual: number; expected: number; colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  const max = Math.max(actual, expected, 1);
  const over = actual > expected && expected > 0;
  const under = actual < expected && expected > 0;
  const diff = Math.abs(actual - expected);
  const diffPct = expected > 0 ? Math.round((diff / expected) * 100) : 0;

  return (
    <View style={[compareStyles.wrap, { backgroundColor: colors.muted + "40", borderColor: colors.border }]}>
      <Text style={[compareStyles.title, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
        {t("ledger.expectedVsActual")}
      </Text>
      {[
        { label: t("ledger.expected"), value: expected, barColor: "#94a3b8", width: (expected / max) * 100 },
        { label: t("ledger.actual"),   value: actual,   barColor: over ? "#ef4444" : under ? "#22c55e" : "#3b82f6", width: (actual / max) * 100 },
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
              ? t("ledger.overBudget", { pct: diffPct, amount: diff.toLocaleString(undefined, { maximumFractionDigits: 0 }) })
              : under
              ? t("ledger.underBudget", { pct: diffPct, amount: diff.toLocaleString(undefined, { maximumFractionDigits: 0 }) })
              : t("ledger.onBudget")}
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
