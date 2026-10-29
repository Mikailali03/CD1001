import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { useGetPropertySummary, getGetPropertySummaryQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { scoreColor } from "./score";

// ── Health score ring (SVG) ───────────────────────────────────────────────────
const RING_R = 28;
const RING_STROKE = 5;
const RING_SIZE = (RING_R + RING_STROKE) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

interface RingProps { propertyId: string; onPress: () => void; colors: ReturnType<typeof useColors> }

export function PropertyScoreRing({ propertyId, onPress, colors }: RingProps) {
  const { data: summary, isLoading } = useGetPropertySummary(propertyId, {
    query: { queryKey: getGetPropertySummaryQueryKey(propertyId) },
  });
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (summary?.healthScore == null) return;
    const t = setTimeout(() => setAnimated(summary.healthScore), 80);
    return () => clearTimeout(t);
  }, [summary?.healthScore]);

  if (isLoading) {
    return (
      <View style={[rStyles.loadingRing, { borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }
  if (!summary) return null;

  const { healthScore, healthGrade } = summary;
  const color = scoreColor(healthScore);
  const cx = RING_SIZE / 2;
  const offset = CIRCUMFERENCE - CIRCUMFERENCE * (animated / 100);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={rStyles.ringBtn}>
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        {/* track */}
        <Circle cx={cx} cy={cx} r={RING_R} fill="none" stroke="#e5e7eb" strokeWidth={RING_STROKE} />
        {/* arc */}
        <Circle
          cx={cx} cy={cx} r={RING_R}
          fill="none" stroke={color} strokeWidth={RING_STROKE}
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90} origin={`${cx}, ${cx}`}
        />
        {/* score */}
        <SvgText x={cx} y={cx - 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
          {healthScore}
        </SvgText>
        {/* grade */}
        <SvgText x={cx} y={cx + 9} textAnchor="middle" fontSize="10" fontWeight="600" fill={color} opacity={0.75}>
          {healthGrade}
        </SvgText>
      </Svg>
    </TouchableOpacity>
  );
}

const rStyles = StyleSheet.create({
  ringBtn: {},
  loadingRing: {
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
});
