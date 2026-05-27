import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface HealthScoreRingProps {
  score: number;
  size?: number;
}

export function HealthScoreRing({ score, size = 120 }: HealthScoreRingProps) {
  const colors = useColors();
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, score / 100)) * circumference;

  const scoreColor =
    score >= 80
      ? "#2A6644"
      : score >= 60
        ? "#B45309"
        : "#EF4444";

  const label =
    score >= 80 ? "Excellent" : score >= 60 ? "Fair" : "Needs Attention";

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={scoreColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <SvgText
          x={size / 2}
          y={size / 2 + 8}
          textAnchor="middle"
          fontSize={size * 0.28}
          fill={scoreColor}
          fontWeight="700"
        >
          {score}
        </SvgText>
      </Svg>
      <View style={styles.label}>
        <SvgText />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  label: {
    marginTop: 4,
  },
});
