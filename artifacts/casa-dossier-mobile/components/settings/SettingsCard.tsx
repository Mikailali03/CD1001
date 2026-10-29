import React from "react";
import { View, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export function SettingsCard({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
});
