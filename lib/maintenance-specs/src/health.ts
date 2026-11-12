/**
 * The one health-score formula, used by the API (property and dashboard
 * scores) and by the web and mobile apps (per-asset badges), so every surface
 * shows the same number.
 */
import { getExpectedLifespan } from "./lifespans";

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365.25 * DAY_MS;

export type AssetHealthInput = {
  category: string;
  name?: string | null;
  installDate?: string | null;
  warrantyExpiry?: string | null;
  status?: string | null;
  /** Date of the most recent service record (YYYY-MM-DD or ISO). Undefined = unknown, null = never serviced. */
  lastServiceDate?: string | null;
  /** Open maintenance tasks on this asset that are past due. */
  overdueTaskCount?: number | null;
};

export type AssetHealthOptions = { state?: string | null; now?: Date };

/** Points taken off for age: up to AGE_MAX at end of expected life, plus PAST_LIFE once past it. */
const AGE_MAX = 60;
const PAST_LIFE = 10;
const UNKNOWN_AGE = 10;
const NEEDS_ATTENTION = 20;
const RECENT_SERVICE_BONUS = 10;
const STALE_SERVICE = 5;
const NEVER_SERVICED = 5;
const PER_OVERDUE = 5;
const MAX_OVERDUE = 20;
const WARRANTY_BONUS = 5;

export type AssetHealthBreakdown = {
  score: number;
  ageYears: number | null;
  lifespanYears: number;
};

/**
 * 0–100 score for one asset.
 *
 * - Age vs expected life (regionally adjusted): up to −60 at end of life, −70 past it; −10 if the install date is unknown.
 * - Status "needs attention": −20.
 * - Service history: +10 if serviced in the last 12 months; −5 if the last service was over 2 years ago,
 *   or if it has never been serviced and is over a year old. Skipped when history isn't known.
 * - Overdue maintenance: −5 per overdue task, up to −20.
 * - Active warranty: +5.
 */
export function calcAssetHealth(asset: AssetHealthInput, opts: AssetHealthOptions = {}): AssetHealthBreakdown {
  const now = opts.now ?? new Date();
  const lifespanYears = getExpectedLifespan(asset.category, asset.name ?? "", opts.state);
  let score = 100;
  let ageYears: number | null = null;

  if (asset.installDate) {
    const installed = new Date(asset.installDate).getTime();
    if (Number.isFinite(installed)) {
      ageYears = Math.max(0, (now.getTime() - installed) / YEAR_MS);
      const used = ageYears / lifespanYears;
      score -= Math.round(Math.min(used, 1) * AGE_MAX);
      if (used > 1) score -= PAST_LIFE;
    }
  }
  if (ageYears == null) score -= UNKNOWN_AGE;

  if (asset.status === "needs_attention") score -= NEEDS_ATTENTION;

  if (asset.lastServiceDate) {
    const sinceService = (now.getTime() - new Date(asset.lastServiceDate).getTime()) / YEAR_MS;
    if (sinceService <= 1) score += RECENT_SERVICE_BONUS;
    else if (sinceService > 2) score -= STALE_SERVICE;
  } else if (asset.lastServiceDate === null && (ageYears == null || ageYears > 1)) {
    score -= NEVER_SERVICED;
  }

  if (asset.overdueTaskCount) score -= Math.min(asset.overdueTaskCount * PER_OVERDUE, MAX_OVERDUE);

  if (asset.warrantyExpiry && new Date(asset.warrantyExpiry) > now) score += WARRANTY_BONUS;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    ageYears: ageYears == null ? null : Math.round(ageYears * 10) / 10,
    lifespanYears,
  };
}

/** Convenience: just the 0–100 number. */
export function calcAssetHealthScore(asset: AssetHealthInput, opts: AssetHealthOptions = {}): number {
  return calcAssetHealth(asset, opts).score;
}

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

/** Shared letter-grade thresholds. */
export function healthGrade(score: number): HealthGrade {
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
}

/** Assets scoring below this count as critical and dominate the home score. */
export const CRITICAL_ASSET_SCORE = 40;
const NON_CRITICAL_WEIGHT = 0.1;
const PER_HOME_OVERDUE = 15;

export function calcOverdueScore(overdueCount: number): number {
  return Math.max(0, 100 - overdueCount * PER_HOME_OVERDUE);
}

/**
 * Whole-home score: half asset condition (critical assets weigh 10× the rest;
 * with no critical assets it's 100), half overdue maintenance (−15 per overdue
 * task), plus 1 per task completed in the last 15 days, capped at 100.
 */
export function calcHomeHealth(
  assetScores: number[],
  overdueCount: number,
  recentCompletedCount = 0,
): { score: number; grade: HealthGrade; assetAgeScore: number; overdueScore: number } {
  let assetAgeScore = 100;
  const critical = assetScores.filter((s) => s < CRITICAL_ASSET_SCORE);
  if (critical.length > 0) {
    const healthy = assetScores.filter((s) => s >= CRITICAL_ASSET_SCORE);
    const totalWeight = critical.length + healthy.length * NON_CRITICAL_WEIGHT;
    const weighted =
      critical.reduce((sum, s) => sum + s, 0) + healthy.reduce((sum, s) => sum + s * NON_CRITICAL_WEIGHT, 0);
    assetAgeScore = Math.round(weighted / totalWeight);
  }

  const overdueScore = calcOverdueScore(overdueCount);
  const score = Math.min(100, Math.round(assetAgeScore * 0.5 + overdueScore * 0.5) + recentCompletedCount);
  return { score, grade: healthGrade(score), assetAgeScore, overdueScore };
}
