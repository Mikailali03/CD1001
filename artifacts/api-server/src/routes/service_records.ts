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
import { toDateOnly } from "../lib/dates.js";
import { recordAuditInBackground } from "../lib/audit.js";
import { isReservedCompanyName, RESERVED_COMPANY_NAME_ERROR } from "../lib/provenance.js";

const router = Router();

router.get("/assets/:assetId/records", requireAuth(), async (req, res) => {
  const { assetId } = ListServiceRecordsParams.parse(req.params);

  const asset = await getAccessibleAsset(assetId, req.userId);
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

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
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  if (asset.retiredAt) {
    res.status(409).json({ error: "This asset is retired, so no new records can be added." });
    return;
  }
  if (isReservedCompanyName(body.companyName)) {
    res.status(400).json({ error: RESERVED_COMPANY_NAME_ERROR });
    return;
  }

  // Records created here are always self-reported: "verified" isn't in the body
  // schema, and only a CasaService technician completing a job creates verified ones.
  const { date, nextServiceDate, ...rest } = body;
  const [record] = await db
    .insert(serviceRecordsTable)
    .values({
      ...rest,
      assetId,
      date: toDateOnly(date),
      nextServiceDate: toDateOnly(nextServiceDate) ?? null,
      cost: body.cost != null ? String(body.cost) : null,
      verified: false,
      createdByUserId: req.userId,
    })
    .returning();
  recordAuditInBackground({
    actorUserId: req.userId,
    action: "service_record.created",
    entityType: "service_record",
    entityId: record!.id,
    propertyId: asset.propertyId,
    details: { assetId, date: record!.date, description: record!.description },
  });
  res.status(201).json(record);
});

router.get("/records/:recordId", requireAuth(), async (req, res) => {
  const { recordId } = GetServiceRecordParams.parse(req.params);

  const rows = await db
    .select({ record: serviceRecordsTable, assetId: serviceRecordsTable.assetId })
    .from(serviceRecordsTable)
    .where(eq(serviceRecordsTable.id, recordId));

  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  const accessibleAsset = await getAccessibleAsset(row.assetId, req.userId);
  if (!accessibleAsset) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  res.json(row.record);
});

export default router;
