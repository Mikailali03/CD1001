import React from "react";
import { View, StyleSheet } from "react-native";
import { URGENCY_CONFIG, type Urgency } from "./urgency";

// ── Life bar ───────────────────────────────────────────────────────────────────
export function LifeBar({ percent, urgency }: { percent: number; urgency: Urgency }) {
  const color = URGENCY_CONFIG[urgency].barColor;
  return (
    <View style={lifeStyles.track}>
      <View style={[lifeStyles.fill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}
const lifeStyles = StyleSheet.create({
  track: { height: 5, borderRadius: 3, backgroundColor: "#E8E5DF", overflow: "hidden", marginVertical: 4 },
  fill: { height: 5, borderRadius: 3 },
});
