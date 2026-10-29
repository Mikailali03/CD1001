// Shared per-asset scoring + category config used by the assets list and the
// asset detail page. Expected lifespans come from @workspace/maintenance-specs
// so web scores agree with the server's health score and Capital Outlook.
import { getExpectedLifespan } from "@workspace/maintenance-specs";

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
};

/** 0–100 health score from age vs expected lifespan, status and warranty. */
export function calcScore(asset: ScorableAsset): number {
  let score = 100;
  if (asset.installDate) {
    const lifespan = getExpectedLifespan(asset.category, asset.name ?? "");
    const ageYears = (Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    score -= Math.round(Math.min(ageYears / lifespan, 1) * 40);
  }
  if (asset.status === "needs_attention") score -= 25;
  else if (asset.status === "unverified") score -= 5;
  if (asset.status === "verified") score = Math.min(score + 5, 100);
  if (asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date()) score = Math.min(score + 5, 100);
  return Math.max(0, Math.round(score));
}

export type GradeLabel = "excellent" | "good" | "fair" | "poor" | "critical";

/** Letter grade + color; translate `labelKey` with `t(\`assets.grade.${labelKey}\`)`. */
export function gradeFromScore(score: number): { grade: string; color: string; labelKey: GradeLabel } {
  if (score >= 90) return { grade: "A", color: "#3d7a5f", labelKey: "excellent" };
  if (score >= 75) return { grade: "B", color: "#4b7fb5", labelKey: "good" };
  if (score >= 55) return { grade: "C", color: "#c8853a", labelKey: "fair" };
  if (score >= 35) return { grade: "D", color: "#b85a2a", labelKey: "poor" };
  return { grade: "F", color: "#c0392b", labelKey: "critical" };
}

/** Recurrence choices for maintenance tasks; translate with `t(labelKey)`. */
export const INTERVAL_OPTIONS = [
  { value: "30", labelKey: "assets.interval.d30" },
  { value: "60", labelKey: "assets.interval.d60" },
  { value: "90", labelKey: "assets.interval.d90" },
  { value: "180", labelKey: "assets.interval.d180" },
  { value: "365", labelKey: "assets.interval.d365" },
] as const;
