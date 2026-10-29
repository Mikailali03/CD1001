import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({
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

export const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 11, lineHeight: 14 },
  value: { fontSize: 24 },
  sub: { fontSize: 11, marginTop: 2 },
});
