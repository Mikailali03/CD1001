import { Router } from "express";
import { db } from "@workspace/db";
import { serviceRecordsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateServiceRecordBody,
  CreateServiceRecordParams,
  ListServiceRecordsParams,
  GetServiceRecordParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/assets/:assetId/records", async (req, res) => {
  const { assetId } = ListServiceRecordsParams.parse(req.params);
  const records = await db
    .select()
    .from(serviceRecordsTable)
    .where(eq(serviceRecordsTable.assetId, assetId))
    .orderBy(serviceRecordsTable.date);
  res.json(records);
});

router.post("/assets/:assetId/records", async (req, res) => {
  const { assetId } = CreateServiceRecordParams.parse(req.params);
  const body = CreateServiceRecordBody.parse(req.body);
  const [record] = await db
    .insert(serviceRecordsTable)
    .values({ ...body, assetId, cost: body.cost != null ? String(body.cost) : null })
    .returning();
  res.status(201).json(record);
});

router.get("/records/:recordId", async (req, res) => {
  const { recordId } = GetServiceRecordParams.parse(req.params);
  const [record] = await db
    .select()
    .from(serviceRecordsTable)
    .where(eq(serviceRecordsTable.id, recordId));
  if (!record) return res.status(404).json({ error: "Record not found" });
  res.json(record);
});

export default router;
