import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useTranslation } from "react-i18next";

// ── Grade config (matches web exactly) ────────────────────────────────────────
export const GRADE_CONFIG = {
  // Label and call-to-action text: home.grade.<letter>.label / .cta
  A: { color: "#3d7a5f", bg: "#3d7a5f12" },
  B: { color: "#4b7fb5", bg: "#4b7fb512" },
  C: { color: "#c8853a", bg: "#c8853a12" },
  D: { color: "#b85a2a", bg: "#b85a2a12" },
  F: { color: "#c0392b", bg: "#c0392b0e" },
} as const;

export type Grade = keyof typeof GRADE_CONFIG;

// ── Health Score Widget (matches web's HealthScoreWidget) ─────────────────────
export function HealthScoreWidget({ score, grade, overdueCount }: { score: number; grade: Grade; overdueCount: number }) {
  const { t } = useTranslation();
  const cfg = GRADE_CONFIG[grade];
  const radius = 26, stroke = 5;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  return (
    <View style={[hStyles.wrap, { borderColor: cfg.color + "44", backgroundColor: "rgba(255,255,255,0.9)" }]}>
      {/* SVG ring */}
      <View style={hStyles.ringWrap}>
        <Svg width={66} height={66} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={33} cy={33} r={radius} fill="none" stroke={cfg.bg} strokeWidth={stroke} />
          <Circle
            cx={33} cy={33} r={radius} fill="none"
            stroke={cfg.color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={hStyles.ringCenter}>
            <Text style={[hStyles.score, { color: cfg.color, fontFamily: "Inter_700Bold" }]}>{score}</Text>
            <Text style={[hStyles.scoreLabel, { color: "#9CA3AF", fontFamily: "Inter_400Regular" }]}>/100</Text>
          </View>
        </View>
      </View>

      {/* Grade info */}
      <View style={hStyles.info}>
        <View style={hStyles.gradeRow}>
          <Text style={[hStyles.gradeText, { color: cfg.color, fontFamily: "Inter_700Bold" }]}>{t("home.gradeLabel", { grade })}</Text>
          <View style={[hStyles.gradePill, { backgroundColor: cfg.bg }]}>
            <Text style={[hStyles.gradePillText, { color: cfg.color, fontFamily: "Inter_700Bold" }]}>{t(`home.grade.${grade}.label`)}</Text>
          </View>
        </View>
        <Text style={[hStyles.ctaText, { color: "#6B7A8E", fontFamily: "Inter_400Regular" }]}>{t(`home.grade.${grade}.cta`)}</Text>
        {overdueCount > 0 && (
          <View style={hStyles.overdueRow}>
            <Feather name="trending-up" size={11} color={cfg.color} />
            <Text style={[hStyles.overdueText, { color: cfg.color, fontFamily: "Inter_600SemiBold" }]}>
              {t("home.seeImprovementPlan")}
            </Text>
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={16} color="#9CA3AF" />
    </View>
  );
}

const hStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  ringWrap: { width: 66, height: 66, position: "relative" },
  ringCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 0 },
  score: { fontSize: 18, lineHeight: 20 },
  scoreLabel: { fontSize: 9 },
  info: { flex: 1, gap: 3 },
  gradeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  gradeText: { fontSize: 13 },
  gradePill: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  gradePillText: { fontSize: 10 },
  ctaText: { fontSize: 11 },
  overdueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  overdueText: { fontSize: 11 },
});
