import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

// ── Spec row ──────────────────────────────────────────────────────────────────
export function SpecRow({ label, value, mono, colors }: { label: string; value: string; mono?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[specStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[specStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
      <Text style={[specStyles.value, { color: colors.foreground, fontFamily: mono ? "Inter_400Regular" : "Inter_500Medium", fontVariant: mono ? ["tabular-nums"] : undefined }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
const specStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  label: { fontSize: 13 },
  value: { fontSize: 13, flexShrink: 1, textAlign: "right" },
});
