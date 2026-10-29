import type { CompleteMaintenanceTaskBody, AssetHealthScore } from "@workspace/api-client-react";
import type { MaintenanceTaskWithAsset } from "@workspace/api-client-react";

// ── Types ─────────────────────────────────────────────────────────────────────
// estimatedCost is a decimal string ("45.00") at runtime — read it through Number()
export type OverdueTask = MaintenanceTaskWithAsset;

export type AssetScore = AssetHealthScore;

export type CompletePayload = CompleteMaintenanceTaskBody & { isDiy: boolean; completedDate: string };

// ── Priority colors ───────────────────────────────────────────────────────────
export const PRIORITY_BG: Record<string, string> = {
  high: "#fef2f2",
  medium: "#fffbeb",
  low: "#f1f5f9",
};
export const PRIORITY_COLOR: Record<string, string> = {
  high: "#b91c1c",
  medium: "#92400e",
  low: "#475569",
};
