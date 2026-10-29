import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export function FieldRow({
  label,
  colors,
  children,
  last,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  fieldLabel: { fontSize: 13, width: 82 },
});
