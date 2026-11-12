import { db, serviceRecordsTable, maintenanceTasksTable } from "@workspace/db";
import { and, inArray, isNull, lt, max, count } from "drizzle-orm";
import { estimateReplacementCost } from "@workspace/maintenance-specs";
import { calcAssetScore, type AssetForScore, type AssetServiceContext } from "../health-score.js";

/** Latest service date and overdue-task count per asset, for the shared health formula. */
export async function loadAssetServiceContext(
  assetIds: string[],
  state?: string | null,
): Promise<AssetServiceContext> {
  const lastServiceDates = new Map<string, string>();
  const overdueCounts = new Map<string, number>();
  if (assetIds.length === 0) return { lastServiceDates, overdueCounts, state };

  const today = new Date().toISOString().split("T")[0]!;
  const [latest, overdue] = await Promise.all([
    db
      .select({ assetId: serviceRecordsTable.assetId, last: max(serviceRecordsTable.date) })
      .from(serviceRecordsTable)
      .where(inArray(serviceRecordsTable.assetId, assetIds))
      .groupBy(serviceRecordsTable.assetId),
    db
      .select({ assetId: maintenanceTasksTable.assetId, n: count() })
      .from(maintenanceTasksTable)
      .where(and(
        inArray(maintenanceTasksTable.assetId, assetIds),
        isNull(maintenanceTasksTable.completedAt),
        lt(maintenanceTasksTable.nextDueDate, today),
      ))
      .groupBy(maintenanceTasksTable.assetId),
  ]);
  for (const r of latest) if (r.last) lastServiceDates.set(r.assetId, r.last);
  for (const r of overdue) overdueCounts.set(r.assetId, Number(r.n));
  return { lastServiceDates, overdueCounts, state };
}

type EnrichableAsset = AssetForScore & { replacementCost?: string | number | null };

/**
 * Adds the server-computed health fields to asset responses, so the web and
 * mobile badges show exactly the number the property score is built from.
 */
export function withHealth<T extends EnrichableAsset>(asset: T, ctx: AssetServiceContext) {
  const { score, lifespanYears } = calcAssetScore(asset, ctx);
  return {
    ...asset,
    healthScore: score,
    expectedLifespanYears: lifespanYears,
    lastServiceDate: ctx.lastServiceDates.get(asset.id) ?? null,
    overdueTaskCount: ctx.overdueCounts.get(asset.id) ?? 0,
    estimatedReplacementCost: estimateReplacementCost(asset.category, asset.name, ctx.state),
  };
}
