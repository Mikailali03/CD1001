import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { gradeFromScore } from "@/components/AssetCard";

// ── Large Radial Gauge ─────────────────────────────────────────────────────────
export function LargeRadialGauge({ score }: { score: number }) {
  const { grade, color } = gradeFromScore(score);
  const { t } = useTranslation();
  const radius = 52, strokeW = 7;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  const { Svg, Circle } = require("react-native-svg");

  return (
    <View style={gaugeStyles.wrap}>
      <Svg width={122} height={122} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={61} cy={61} r={radius} fill="none" stroke={color + "25"} strokeWidth={strokeW} />
        <Circle cx={61} cy={61} r={radius} fill="none" stroke={color} strokeWidth={strokeW}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, gaugeStyles.center]}>
        <Text style={[gaugeStyles.grade, { color, fontFamily: "Inter_700Bold" }]}>{grade}</Text>
        <Text style={[gaugeStyles.score, { color, fontFamily: "Inter_700Bold" }]}>{score}</Text>
        <Text style={[gaugeStyles.label, { color: "#9CA3AF", fontFamily: "Inter_400Regular" }]}>
          {t(`assetDetail.gradeLabel.${grade}`, { defaultValue: "" })}
        </Text>
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  wrap: { width: 122, height: 122, alignSelf: "center" },
  center: { alignItems: "center", justifyContent: "center", gap: 1 },
  grade: { fontSize: 28, lineHeight: 30 },
  score: { fontSize: 14, lineHeight: 16 },
  label: { fontSize: 10 },
});
