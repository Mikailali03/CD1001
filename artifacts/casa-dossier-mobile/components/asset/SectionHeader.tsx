import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

// ── Section header ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, icon, colors }: { title: string; icon: keyof typeof Feather.glyphMap; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={secStyles.row}>
      <Feather name={icon} size={13} color={colors.mutedForeground} />
      <Text style={[secStyles.title, { color: colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}
const secStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  title: { fontSize: 11, letterSpacing: 0.8 },
});
