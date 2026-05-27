export const LIFESPAN_YEARS: Record<string, number> = {
  HVAC:       15,
  Plumbing:   30,
  Electrical: 25,
  Roof:       20,
  Appliance:  10,
  Structural: 50,
  Other:      15,
};

export type AssetHealthScore = {
  assetId: string;
  assetName: string;
  category: string;
  score: number;
  ageYears: number;
  lifespanYears: number;
  installDate?: string | null;
};

export function calcAssetScore(asset: {
  id: string;
  name: string;
  category: string;
  installDate?: string | null;
}): AssetHealthScore {
  const lifespanYears = LIFESPAN_YEARS[asset.category] ?? 15;

  if (!asset.installDate) {
    return {
      assetId: asset.id,
      assetName: asset.name,
      category: asset.category,
      score: 50,
      ageYears: 0,
      lifespanYears,
      installDate: asset.installDate,
    };
  }

  const installMs = new Date(asset.installDate).getTime();
  const ageYears = (Date.now() - installMs) / (1000 * 60 * 60 * 24 * 365.25);
  const raw = (1 - ageYears / lifespanYears) * 100;
  const score = Math.round(Math.max(0, Math.min(100, raw)));

  return {
    assetId: asset.id,
    assetName: asset.name,
    category: asset.category,
    score,
    ageYears: Math.round(ageYears * 10) / 10,
    lifespanYears,
    installDate: asset.installDate,
  };
}

export function calcOverdueScore(overdueCount: number): number {
  return Math.max(0, 100 - overdueCount * 15);
}

const CRITICAL_THRESHOLD = 40;
const NON_CRITICAL_WEIGHT = 0.1;

export function calcHealthScore(
  assetScores: AssetHealthScore[],
  overdueCount: number,
  recentCompletedCount = 0
): { score: number; grade: "A" | "B" | "C" | "D" | "F"; assetAgeScore: number; overdueScore: number } {
  let assetAgeScore: number;

  if (assetScores.length === 0) {
    assetAgeScore = 100;
  } else {
    const critical = assetScores.filter((s) => s.score < CRITICAL_THRESHOLD);
    if (critical.length === 0) {
      // No critical assets — treat asset condition as perfect
      assetAgeScore = 100;
    } else {
      // Weighted average: critical assets at weight 1.0, non-critical at 0.1
      const totalWeight = critical.length * 1.0 + (assetScores.length - critical.length) * NON_CRITICAL_WEIGHT;
      const weightedSum =
        critical.reduce((sum, s) => sum + s.score * 1.0, 0) +
        assetScores.filter((s) => s.score >= CRITICAL_THRESHOLD).reduce((sum, s) => sum + s.score * NON_CRITICAL_WEIGHT, 0);
      assetAgeScore = Math.round(weightedSum / totalWeight);
    }
  }

  const overdueScore = calcOverdueScore(overdueCount);
  const rawScore = Math.round(assetAgeScore * 0.5 + overdueScore * 0.5);
  // +1 per maintenance task completed in the last 15 days, capped at 100
  const score = Math.min(100, rawScore + recentCompletedCount);

  const grade =
    score >= 90 ? "A"
    : score >= 75 ? "B"
    : score >= 60 ? "C"
    : score >= 45 ? "D"
    : "F";

  return { score, grade, assetAgeScore, overdueScore };
}
