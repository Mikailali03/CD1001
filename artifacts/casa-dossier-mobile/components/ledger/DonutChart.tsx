import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { catColor, fmt$ } from "./categoryColors";

// ── SVG Donut Chart ────────────────────────────────────────────────────────────
export function DonutChart({ data, total, colors }: { data: { name: string; value: number }[]; total: number; colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  const { Svg, Path, Text: SvgText } = require("react-native-svg");
  const size = 150, cx = 75, cy = 75, outerR = 60, innerR = 38;

  function polarToXY(angle: number, r: number) {
    return {
      x: cx + r * Math.cos((angle * Math.PI) / 180),
      y: cy + r * Math.sin((angle * Math.PI) / 180),
    };
  }

  function describeArc(startAngle: number, endAngle: number) {
    const s = polarToXY(startAngle, outerR);
    const e = polarToXY(endAngle, outerR);
    const si = polarToXY(startAngle, innerR);
    const ei = polarToXY(endAngle, innerR);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${s.x} ${s.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${e.x} ${e.y}`,
      `L ${ei.x} ${ei.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${si.x} ${si.y}`,
      "Z",
    ].join(" ");
  }

  let currentAngle = -90;
  const arcs = data.map((d) => {
    const sweep = (d.value / total) * 360;
    const start = currentAngle;
    currentAngle += sweep;
    return { ...d, path: describeArc(start, currentAngle - 0.5), color: catColor(d.name) };
  });

  return (
    <Svg width={size} height={size}>
      {arcs.map((arc) => (
        <Path key={arc.name} d={arc.path} fill={arc.color} />
      ))}
      <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight="700" fill={colors.foreground}>
        {fmt$(total)}
      </SvgText>
      <SvgText x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill={colors.mutedForeground}>
        {t("ledger.totalSpent")}
      </SvgText>
    </Svg>
  );
}

