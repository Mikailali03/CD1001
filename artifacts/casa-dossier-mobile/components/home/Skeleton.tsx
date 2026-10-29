import React from "react";
import { View, type DimensionValue } from "react-native";
import { useColors } from "@/hooks/useColors";

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ height, width, borderRadius, colors }: {
  height: number; width?: DimensionValue; borderRadius?: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{
      height, width: width ?? "100%",
      borderRadius: borderRadius ?? 8,
      backgroundColor: colors.muted,
    }} />
  );
}
