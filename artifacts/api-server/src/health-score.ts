import { calcAssetHealth, calcHomeHealth, CRITICAL_ASSET_SCORE } from "@workspace/maintenance-specs";

// Thin server wrappers around the shared formula in @workspace/maintenance-specs,
// so the API, web and mobile all compute the same scores.

export type AssetHealthScore = {
  assetId: string;
  assetName: string;
  category: string;
  score: number;
  ageYears: number;
  lifespanYears: number;
  installDate?: string | null;
};

export type AssetForScore = {
  id: string;
  name: string;
  category: string;
  installDate?: string | null;
  warrantyExpiry?: string | null;
  status?: string | null;
};

export type AssetServiceContext = {
  /** Latest service date per asset id; assets missing from the map have never been serviced. */
  lastServiceDates: Map<string, string>;
  /** Overdue open-task count per asset id. */
  overdueCounts: Map<string, number>;
  state?: string | null;
  now?: Date;
};

/** `state` overrides ctx.state, for callers scoring assets from several properties. */
export function calcAssetScore(asset: AssetForScore, ctx?: AssetServiceContext, state?: string | null): AssetHealthScore {
  const { score, ageYears, lifespanYears } = calcAssetHealth(
    {
      ...asset,
      lastServiceDate: ctx ? (ctx.lastServiceDates.get(asset.id) ?? null) : undefined,
      overdueTaskCount: ctx?.overdueCounts.get(asset.id) ?? 0,
    },
    { state: state ?? ctx?.state, now: ctx?.now },
  );
  return {
    assetId: asset.id,
    assetName: asset.name,
    category: asset.category,
    score,
    ageYears: ageYears ?? 0,
    lifespanYears,
    installDate: asset.installDate,
  };
}

export const CRITICAL_THRESHOLD = CRITICAL_ASSET_SCORE;

export function calcHealthScore(assetScores: AssetHealthScore[], overdueCount: number, recentCompletedCount = 0) {
  return calcHomeHealth(assetScores.map((s) => s.score), overdueCount, recentCompletedCount);
}
