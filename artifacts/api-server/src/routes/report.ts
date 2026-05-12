import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable, serviceRecordsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty } from "../lib/access.js";

const router = Router();

router.get("/properties/:propertyId/report", requireAuth(), async (req, res) => {
  const { propertyId } = req.params;

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const allAssets = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.propertyId, propertyId))
    .orderBy(assetsTable.createdAt);

  const assetIds = allAssets.map((a) => a.id);

  let allRecords: (typeof serviceRecordsTable.$inferSelect)[] = [];
  for (const assetId of assetIds) {
    const records = await db
      .select()
      .from(serviceRecordsTable)
      .where(eq(serviceRecordsTable.assetId, assetId))
      .orderBy(serviceRecordsTable.date);
    allRecords.push(...records);
  }

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
