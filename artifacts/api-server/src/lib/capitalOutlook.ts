import { getExpectedLifespan, resolveReplacementCost } from "@workspace/maintenance-specs";

// Pure Capital Outlook math, kept apart from the route so it can be unit-tested.

export type Urgency = "critical" | "warning" | "good" | "unknown";

export function getUrgency(yearsRemaining: number | null): Urgency {
  if (yearsRemaining == null) return "unknown";
  if (yearsRemaining <= 3) return "critical";
  if (yearsRemaining <= 8) return "warning";
  return "good";
}

export type OutlookAsset = {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  installDate?: string | null;
  replacementCost?: string | number | null;
};

const HORIZON_YEARS = 20;

/**
 * Projected replacement year and cost per asset, a 20-year cost timeline, and
 * 5/10-year totals. Costs are in today's dollars. Where the owner hasn't
 * entered a replacement cost, a regional estimate is used and flagged with
 * `replacementCostIsEstimate`; the totals report how much of them is estimated.
 */
export function buildCapitalOutlook(assets: OutlookAsset[], opts: { state?: string | null; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const currentYear = now.getFullYear();

  const enriched = assets.map((asset) => {
    const lifespan = getExpectedLifespan(asset.category, asset.name, opts.state);
    // Date-only strings parse as UTC midnight; read the UTC year so a Jan 1
    // install doesn't become the previous year in US timezones.
    const installYear = asset.installDate ? new Date(asset.installDate).getUTCFullYear() : null;
    const replacementYear = installYear != null ? installYear + lifespan : null;
    const yearsRemaining = replacementYear != null ? replacementYear - currentYear : null;
    const ageYears = installYear != null ? currentYear - installYear : null;
    const percentLifeUsed = ageYears != null ? Math.min(100, Math.round((ageYears / lifespan) * 100)) : null;
    const { cost, isEstimate } = resolveReplacementCost(asset, opts.state, now);

    return {
      id: asset.id,
      name: asset.name,
      category: asset.category,
      brand: asset.brand ?? null,
      model: asset.model ?? null,
      installDate: asset.installDate ?? null,
      installYear,
      replacementCost: cost,
      replacementCostIsEstimate: isEstimate,
      expectedLifespanYears: lifespan,
      replacementYear,
      yearsRemaining,
      urgency: getUrgency(yearsRemaining),
      ageYears,
      percentLifeUsed,
    };
  });

  const totalTrackedValue = enriched.reduce((sum, a) => sum + (a.replacementCost ?? 0), 0);
  const estimatedTrackedValue = enriched.reduce(
    (sum, a) => sum + (a.replacementCostIsEstimate ? (a.replacementCost ?? 0) : 0),
    0,
  );

  const timelineMap = new Map<number, { projectedCost: number; estimatedCost: number; assetNames: string[] }>();
  for (let y = currentYear; y <= currentYear + HORIZON_YEARS; y++) {
    timelineMap.set(y, { projectedCost: 0, estimatedCost: 0, assetNames: [] });
  }

  for (const asset of enriched) {
    if (asset.replacementYear == null || asset.replacementCost == null) continue;
    // Anything already past its expected life is due now.
    const yr = Math.max(asset.replacementYear, currentYear);
    const entry = timelineMap.get(yr);
    if (!entry) continue;
    entry.projectedCost += asset.replacementCost;
    if (asset.replacementCostIsEstimate) entry.estimatedCost += asset.replacementCost;
    entry.assetNames.push(asset.name);
  }

  const timeline = Array.from(timelineMap.entries())
    .map(([year, v]) => ({ year, projectedCost: v.projectedCost, estimatedCost: v.estimatedCost, assetNames: v.assetNames }))
    .sort((a, b) => a.year - b.year);

  const upcoming = enriched
    .filter((a) => a.replacementYear != null && a.replacementCost != null)
    .sort((a, b) => a.replacementYear! - b.replacementYear!);

  const nextReplacement = upcoming[0]
    ? {
        name: upcoming[0].name,
        year: Math.max(upcoming[0].replacementYear!, currentYear),
        cost: upcoming[0].replacementCost!,
        costIsEstimate: upcoming[0].replacementCostIsEstimate,
      }
    : null;

  const sumYears = (n: number, key: "projectedCost" | "estimatedCost") =>
    timeline.filter((t) => t.year < currentYear + n).reduce((s, t) => s + t[key], 0);

  return {
    totalTrackedValue,
    estimatedTrackedValue,
    assets: enriched,
    timeline,
    summary: {
      nextReplacement,
      next5YearCost: sumYears(5, "projectedCost"),
      next10YearCost: sumYears(10, "projectedCost"),
      next5YearEstimatedCost: sumYears(5, "estimatedCost"),
      next10YearEstimatedCost: sumYears(10, "estimatedCost"),
    },
  };
}
