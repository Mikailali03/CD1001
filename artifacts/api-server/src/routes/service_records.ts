import { Router } from "express";
import { db } from "@workspace/db";
import { serviceRecordsTable, assetsTable, propertiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateServiceRecordBody,
  CreateServiceRecordParams,
  ListServiceRecordsParams,
  GetServiceRecordParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedAsset } from "../lib/access.js";

const router = Router();

router.get("/assets/:assetId/records", requireAuth(), async (req, res) => {
  const { assetId } = ListServiceRecordsParams.parse(req.params);

  const asset = await getOwnedAsset(assetId, req.userId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const records = await db
    .select()
    .from(serviceRecordsTable)
    .where(eq(serviceRecordsTable.assetId, assetId))
    .orderBy(serviceRecordsTable.date);
  res.json(records);
});

router.post("/assets/:assetId/records", requireAuth(), async (req, res) => {
  const { assetId } = CreateServiceRecordParams.parse(req.params);
  const body = CreateServiceRecordBody.parse(req.body);

  const asset = await getOwnedAsset(assetId, req.userId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const [record] = await db
    .insert(serviceRecordsTable)
    .values({ ...body, assetId, cost: body.cost != null ? String(body.cost) : null })
    .returning();
  res.status(201).json(record);
});

router.get("/records/:recordId", requireAuth(), async (req, res) => {
  const { recordId } = GetServiceRecordParams.parse(req.params);

  const rows = await db
    .select({ record: serviceRecordsTable })
    .from(serviceRecordsTable)
    .innerJoin(assetsTable, eq(serviceRecordsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(and(eq(serviceRecordsTable.id, recordId), eq(propertiesTable.userId, req.userId)));

  const record = rows[0]?.record;
  if (!record) return res.status(404).json({ error: "Record not found" });
  res.json(record);
});

export default router;
