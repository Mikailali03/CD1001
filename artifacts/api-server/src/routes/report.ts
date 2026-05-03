import { Router } from "express";
import { db } from "@workspace/db";
import { propertiesTable, assetsTable, serviceRecordsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/properties/:propertyId/report", async (req, res) => {
  const { propertyId } = req.params;

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, propertyId));

  if (!property) return res.status(404).json({ error: "Property not found" });

  const allAssets = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.propertyId, propertyId))
    .orderBy(assetsTable.createdAt);

  const assetIds = allAssets.map((a) => a.id);

  let allRecords: (typeof serviceRecordsTable.$inferSelect)[] = [];
  if (assetIds.length > 0) {
    allRecords = await db
      .select()
      .from(serviceRecordsTable)
      .where(
        assetIds.length === 1
          ? eq(serviceRecordsTable.assetId, assetIds[0]!)
          : eq(serviceRecordsTable.assetId, assetIds[0]!)
      )
      .orderBy(serviceRecordsTable.date);

    // Fetch records for all assets manually since drizzle doesn't have easy inArray here
    allRecords = [];
    for (const assetId of assetIds) {
      const records = await db
        .select()
        .from(serviceRecordsTable)
        .where(eq(serviceRecordsTable.assetId, assetId))
        .orderBy(serviceRecordsTable.date);
      allRecords.push(...records);
    }
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

  const totalEvents = allRecords.length;

  res.json({
    property,
    activeAssets,
    retiredAssets,
    totalEvents,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
