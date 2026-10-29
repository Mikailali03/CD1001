import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable, serviceRecordsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty } from "../lib/access.js";
import { z } from "zod";

const router = Router();

const ReportParams = z.object({ propertyId: z.string() });

router.get("/properties/:propertyId/report", requireAuth(), async (req, res) => {
  const { propertyId } = ReportParams.parse(req.params);

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const allAssets = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.propertyId, propertyId))
    .orderBy(assetsTable.createdAt);

  const assetIds = allAssets.map((a) => a.id);

  const allRecords = assetIds.length
    ? await db
        .select()
        .from(serviceRecordsTable)
        .where(inArray(serviceRecordsTable.assetId, assetIds))
        .orderBy(serviceRecordsTable.date)
    : [];

  const recordsByAsset: Record<string, typeof allRecords> = {};
  for (const record of allRecords) {
    if (!recordsByAsset[record.assetId]) recordsByAsset[record.assetId] = [];
    recordsByAsset[record.assetId]!.push(record);
  }

  const activeAssets = allAssets.filter((a) => !a.retiredAt).map((a) => ({
    ...a,
    records: recordsByAsset[a.id] ?? [],
  }));

  const retiredAssets = allAssets.filter((a) => !!a.retiredAt).map((a) => ({
    ...a,
    records: recordsByAsset[a.id] ?? [],
  }));

  res.json({
    property,
    activeAssets,
    retiredAssets,
    totalEvents: allRecords.length,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
