// Shared per-asset scoring + category config used by the assets list and the
// asset detail page. The formula itself lives in @workspace/maintenance-specs
// so web scores agree with the server's health score and Capital Outlook.
import { calcAssetHealthScore, healthGrade } from "@workspace/maintenance-specs";

/** Display-only styling per category. */
export type CategoryConfig = { emoji: string; color: string; bg: string };

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  HVAC:       { emoji: "❄️",  color: "#3b82f6", bg: "#3b82f615" },
  Plumbing:   { emoji: "🔧",  color: "#06b6d4", bg: "#06b6d415" },
  Electrical: { emoji: "⚡",  color: "#eab308", bg: "#eab30815" },
  Roof:       { emoji: "🏠",  color: "#78716c", bg: "#78716c15" },
  Appliance:  { emoji: "🫙",  color: "#8b5cf6", bg: "#8b5cf615" },
  Structural: { emoji: "🏗️", color: "#22c55e", bg: "#22c55e15" },
  Other:      { emoji: "📦",  color: "#94a3b8", bg: "#94a3b815" },
};

export function categoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Other!;
}

export type ScorableAsset = {
  category: string;
  name?: string | null;
  installDate?: string | null;
  warrantyExpiry?: string | null;
  status: string;
  /** Server-computed score from the shared formula; preferred when present. */
  healthScore?: number | null;
  lastServiceDate?: string | null;
  overdueTaskCount?: number | null;
};

/**
 * 0–100 asset health score. Uses the score the API computed (which knows the
 * property's region and full service history); otherwise falls back to the
 * same shared formula with whatever the client has.
 */
export function calcScore(asset: ScorableAsset): number {
  if (typeof asset.healthScore === "number") return asset.healthScore;
  return calcAssetHealthScore(asset);
}

export type GradeLabel = "excellent" | "good" | "fair" | "poor" | "critical";

/** Letter grade + color; translate `labelKey` with `t(\`assets.grade.${labelKey}\`)`. */
export function gradeFromScore(score: number): { grade: string; color: string; labelKey: GradeLabel } {
  // Letter thresholds come from the shared formula so badges match the property grade.
  const grade = healthGrade(score);
  const style: Record<string, { color: string; labelKey: GradeLabel }> = {
    A: { color: "#3d7a5f", labelKey: "excellent" },
    B: { color: "#4b7fb5", labelKey: "good" },
    C: { color: "#c8853a", labelKey: "fair" },
    D: { color: "#b85a2a", labelKey: "poor" },
    F: { color: "#c0392b", labelKey: "critical" },
  };
  return { grade, ...style[grade]! };
}

/** Recurrence choices for maintenance tasks; translate with `t(labelKey)`. */
export const INTERVAL_OPTIONS = [
  { value: "30", labelKey: "assets.interval.d30" },
  { value: "60", labelKey: "assets.interval.d60" },
  { value: "90", labelKey: "assets.interval.d90" },
  { value: "180", labelKey: "assets.interval.d180" },
  { value: "365", labelKey: "assets.interval.d365" },
] as const;
