import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";

type TimelineEntry = { year: number; projectedCost: number; assetNames: string[] };

// ── SVG Bar Chart ──────────────────────────────────────────────────────────────
export function BarChart({ data, currentYear, colors }: { data: TimelineEntry[]; currentYear: number; colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  const { Svg, Rect, Line, Text: SvgText } = require("react-native-svg");
  const width = 340, height = 180, padL = 44, padR = 8, padT = 10, padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxCost = Math.max(...data.map((d) => d.projectedCost), 1);
  const barW = Math.min(Math.floor(chartW / data.length) - 3, 40);

  function barColor(year: number) {
    const diff = year - currentYear;
    if (diff <= 0) return "#ef4444";
    if (diff <= 3) return "#f59e0b";
    if (diff <= 8) return "#3b82f6";
    return "#22c55e";
  }

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCost * f));

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={width} height={height}>
        {/* Y-axis labels + grid */}
        {yLabels.map((v, i) => {
          const y = padT + chartH - (v / maxCost) * chartH;
          return (
            <React.Fragment key={i}>
              <Line x1={padL - 4} y1={y} x2={padL + chartW} y2={y}
                stroke={colors.border} strokeWidth={0.5} strokeDasharray="3 3" />
              <SvgText x={padL - 6} y={y + 3} fontSize={8} fill={colors.mutedForeground} textAnchor="end">
                {v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Bars */}
        {data.map((entry, i) => {
          const barH = Math.max((entry.projectedCost / maxCost) * chartH, entry.projectedCost > 0 ? 2 : 0);
          const x = padL + (i * chartW) / data.length + (chartW / data.length - barW) / 2;
          const y = padT + chartH - barH;
          const isToday = entry.year === currentYear;
          return (
            <React.Fragment key={entry.year}>
              <Rect
                x={x} y={y} width={barW} height={barH}
                fill={barColor(entry.year)}
                fillOpacity={entry.projectedCost > 0 ? 1 : 0.12}
                rx={3}
              />
              {isToday && (
                <Line
                  x1={x + barW / 2} y1={padT} x2={x + barW / 2} y2={padT + chartH}
                  stroke={colors.primary} strokeWidth={1.5} strokeDasharray="3 2"
                />
              )}
              <SvgText
                x={x + barW / 2} y={height - 6}
                fontSize={8} fill={colors.mutedForeground} textAnchor="middle"
              >
                {entry.year % 2 === 0 || data.length <= 8 ? String(entry.year) : ""}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={chartStyles.legend}>
        {[
          { color: "#ef4444", label: t("capitalOutlook.legend.pastDue") },
          { color: "#f59e0b", label: t("capitalOutlook.legend.within3") },
          { color: "#3b82f6", label: t("capitalOutlook.legend.fourToEight") },
          { color: "#22c55e", label: t("capitalOutlook.legend.ninePlus") },
        ].map(({ color, label }) => (
          <View key={label} style={chartStyles.legendItem}>
            <View style={[chartStyles.legendDot, { backgroundColor: color }]} />
            <Text style={[chartStyles.legendText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  legend: { flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10 },
});
