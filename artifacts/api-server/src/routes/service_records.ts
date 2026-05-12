import { Router } from "express";
import { db } from "@workspace/db";
import { serviceRecordsTable, assetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateServiceRecordBody,
  CreateServiceRecordParams,
  ListServiceRecordsParams,
  GetServiceRecordParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleAsset } from "../lib/access.js";

const router = Router();

router.get("/assets/:assetId/records", requireAuth(), async (req, res) => {
  const { assetId } = ListServiceRecordsParams.parse(req.params);

  const asset = await getAccessibleAsset(assetId, req.userId);
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

  const asset = await getAccessibleAsset(assetId, req.userId);
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
    .select({ record: serviceRecordsTable, assetId: serviceRecordsTable.assetId })
    .from(serviceRecordsTable)
    .where(eq(serviceRecordsTable.id, recordId));

  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Record not found" });

  const accessibleAsset = await getAccessibleAsset(row.assetId, req.userId);
  if (!accessibleAsset) return res.status(404).json({ error: "Record not found" });

  res.json(row.record);
});

export default router;
