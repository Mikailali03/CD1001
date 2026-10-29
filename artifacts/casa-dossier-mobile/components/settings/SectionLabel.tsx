import React from "react";
import { Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 4 },
});
