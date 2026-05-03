import { Router } from "express";
import { db } from "@workspace/db";
import { serviceRecordsTable, maintenanceTasksTable, assetsTable } from "@workspace/db";
import { eq, and, gte, lte, isNull, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedProperty } from "../lib/access.js";

const LedgerParams = z.object({ propertyId: z.string() });
const RANGES = ["this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "all_time"] as const;

function getDateRange(range: string): { start: string | null; end: string | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;

  switch (range) {
    case "this_month":
      return { start: fmt(new Date(y, m, 1)), end: fmt(now) };
    case "last_month":
      return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) };
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { start: fmt(new Date(y, q * 3, 1)), end: fmt(now) };
    }
    case "last_quarter": {
      const q = Math.floor(m / 3);
      const lqs = q === 0 ? new Date(y - 1, 9, 1) : new Date(y, (q - 1) * 3, 1);
      const lqe = q === 0 ? new Date(y - 1, 12, 0) : new Date(y, q * 3, 0);
      return { start: fmt(lqs), end: fmt(lqe) };
    }
    case "this_year":
      return { start: fmt(new Date(y, 0, 1)), end: fmt(now) };
    case "last_year":
      return { start: fmt(new Date(y - 1, 0, 1)), end: fmt(new Date(y - 1, 11, 31)) };
    case "all_time":
    default:
      return { start: null, end: null };
  }
}

const router = Router();

router.get("/properties/:propertyId/ledger", requireAuth(), async (req, res) => {
  const { propertyId } = LedgerParams.parse(req.params);

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const range = (RANGES as readonly string[]).includes(String(req.query["range"]))
    ? String(req.query["range"])
    : "this_year";
  const { start, end } = getDateRange(range);

  const assets = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.propertyId, propertyId));

  if (assets.length === 0) {
    return res.json({ records: [], byCategory: [], totals: { actual: 0, expected: 0 } });
  }

  const assetIds = assets.map((a) => a.id);
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const recConds: ReturnType<typeof eq>[] = [inArray(serviceRecordsTable.assetId, assetIds) as any];
  if (start) recConds.push(gte(serviceRecordsTable.date, start) as any);
  if (end)   recConds.push(lte(serviceRecordsTable.date, end) as any);

  const records = await db
    .select()
    .from(serviceRecordsTable)
    .where(and(...recConds))
    .orderBy(desc(serviceRecordsTable.date));

  const taskConds: ReturnType<typeof eq>[] = [
    inArray(maintenanceTasksTable.assetId, assetIds) as any,
    isNull(maintenanceTasksTable.completedAt) as any,
  ];
  if (start) taskConds.push(gte(maintenanceTasksTable.nextDueDate, start) as any);
  if (end)   taskConds.push(lte(maintenanceTasksTable.nextDueDate, end) as any);

  const pendingTasks = await db
    .select()
    .from(maintenanceTasksTable)
    .where(and(...taskConds));

  const actualByCat: Record<string, number> = {};
  const expectedByCat: Record<string, number> = {};

  for (const r of records) {
    if (!r.cost) continue;
    const cat = assetMap.get(r.assetId)?.category ?? "Other";
    actualByCat[cat] = (actualByCat[cat] ?? 0) + parseFloat(r.cost);
  }

  for (const t of pendingTasks) {
    if (!t.estimatedCost) continue;
    const cat = assetMap.get(t.assetId)?.category ?? "Other";
    expectedByCat[cat] = (expectedByCat[cat] ?? 0) + parseFloat(t.estimatedCost);
  }

  const allCats = new Set([...Object.keys(actualByCat), ...Object.keys(expectedByCat)]);
  const byCategory = [...allCats].map((cat) => ({
    category: cat,
    actual: Math.round((actualByCat[cat] ?? 0) * 100) / 100,
    expected: Math.round((expectedByCat[cat] ?? 0) * 100) / 100,
  })).sort((a, b) => b.actual - a.actual);

  const totalActual   = Object.values(actualByCat).reduce((s, v) => s + v, 0);
  const totalExpected = Object.values(expectedByCat).reduce((s, v) => s + v, 0);

  const enrichedRecords = records.map((r) => ({
    ...r,
    assetName:     assetMap.get(r.assetId)?.name     ?? "Unknown",
    assetCategory: assetMap.get(r.assetId)?.category ?? "Other",
  }));

  res.json({
    records:    enrichedRecords,
    byCategory,
    totals: {
      actual:   Math.round(totalActual   * 100) / 100,
      expected: Math.round(totalExpected * 100) / 100,
    },
  });
});

export default router;
