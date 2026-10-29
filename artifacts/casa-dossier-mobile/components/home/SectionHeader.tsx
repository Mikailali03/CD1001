import React from "react";
import { Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

// ── Section header ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[secStyles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
      {title}
    </Text>
  );
}
const secStyles = StyleSheet.create({ title: { fontSize: 14, marginBottom: 10 } });
