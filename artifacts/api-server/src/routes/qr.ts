import { Router } from "express";
import { db } from "@workspace/db";
import {
  assetsTable,
  propertiesTable,
  marketplaceJobsTable,
  serviceRecordsTable,
} from "@workspace/db";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireTechnician, isTechnician } from "../middlewares/requireTechnician.js";
import { getAccessibleAsset, getAccessibleProperty } from "../lib/access.js";
import { isAssetUuid, protocolStringFor, registryIdFor, resolveAssetRef } from "../lib/qr.js";

// QR Identity Protocol — printable asset labels and the scan landing points.
const router = Router();

const ACTIVE_JOB_STATUSES = new Set(["claimed", "en_route", "arrived"]);

// ── Homeowner: label data for a property's assets ─────────────────────────
// Active (non-retired) assets by default; ?assetId= narrows to one asset,
// which may be retired (the asset page offers a label regardless).
const LabelsParams = z.object({ propertyId: z.string() });
const LabelsQuery = z.object({ assetId: z.string().optional() });

router.get("/properties/:propertyId/qr-labels", requireAuth(), async (req, res) => {
  const { propertyId } = LabelsParams.parse(req.params);
  const { assetId } = LabelsQuery.parse(req.query);

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const assets = await db
    .select({ id: assetsTable.id, name: assetsTable.name, category: assetsTable.category })
    .from(assetsTable)
    .where(
      assetId
        ? and(eq(assetsTable.propertyId, propertyId), eq(assetsTable.id, assetId))
        : and(
            eq(assetsTable.propertyId, propertyId),
            isNull(assetsTable.retiredAt),
            // Scout's whole-home "Home Stewardship" bucket isn't physical
            // equipment, so it gets no label (per the QR spec).
            ne(assetsTable.name, "Home Stewardship"),
          ),
    )
    .orderBy(assetsTable.category, assetsTable.name);

  if (assetId && assets.length === 0) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  res.json({
    propertyId: property.id,
    propertyName: property.name,
    labels: assets.map((a) => ({
      assetId: a.id,
      name: a.name,
      category: a.category,
      registryId: registryIdFor(a.id),
      protocol: protocolStringFor(a.id),
    })),
  });
});

// ── Public: what a scanned label reveals to anyone ────────────────────────
// Only the registry ID and the equipment category — never the name, owner,
// address or history. Full UUIDs only (no registry-prefix lookup) so the
// public endpoint can't be used to enumerate assets.
const AssetIdParams = z.object({ assetId: z.string() });

router.get("/qr/assets/:assetId", async (req, res) => {
  const { assetId } = AssetIdParams.parse(req.params);
  if (!isAssetUuid(assetId)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [asset] = await db
    .select({ id: assetsTable.id, category: assetsTable.category })
    .from(assetsTable)
    .where(eq(assetsTable.id, assetId.toLowerCase()));
  if (!asset) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ registryId: registryIdFor(asset.id), category: asset.category });
});

// ── Signed-in: can I open this asset? ─────────────────────────────────────
router.get("/qr/assets/:assetId/access", requireAuth(), async (req, res) => {
  const { assetId } = AssetIdParams.parse(req.params);
  const asset = isAssetUuid(assetId) ? await getAccessibleAsset(assetId.toLowerCase(), req.userId) : null;
  res.json({
    hasAccess: !!asset,
    propertyId: asset?.propertyId ?? null,
    assetId: asset?.id ?? null,
    isTechnician: await isTechnician(req.userId),
  });
});

// ── Technician: scan result ───────────────────────────────────────────────
// Accepts a UUID, registry ID, protocol string or label URL. Mirrors the
// marketplace authz model: open jobs are visible with the open-jobs-list
// redaction; asset details and service history only when this technician
// holds an active (claimed / en route / arrived) job on the asset.
const TechParams = z.object({ ref: z.string() });

router.get("/tech/assets/:ref", requireAuth(), requireTechnician(), async (req, res) => {
  const { ref } = TechParams.parse(req.params);
  const resolved = await resolveAssetRef(ref);
  if (resolved.status === "invalid") {
    res.status(400).json({ error: "Not a recognised asset code or registry ID" });
    return;
  }
  if (resolved.status === "ambiguous") {
    res.status(409).json({ error: "That registry ID matches more than one asset. Scan the QR code instead." });
    return;
  }
  if (resolved.status === "not_found") {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  const assetId = resolved.assetId;

  const [row] = await db
    .select({ asset: assetsTable, property: propertiesTable })
    .from(assetsTable)
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(eq(assetsTable.id, assetId));
  if (!row) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const jobs = await db
    .select()
    .from(marketplaceJobsTable)
    .where(eq(marketplaceJobsTable.assetId, assetId))
    .orderBy(desc(marketplaceJobsTable.createdAt));

  const mine = jobs.filter((j) => j.technicianId === req.userId);
  const open = jobs.filter((j) => j.status === "open");
  const hasActiveJob = mine.some((j) => ACTIVE_JOB_STATUSES.has(j.status));

  const serviceHistory = hasActiveJob
    ? await db
        .select({
          id: serviceRecordsTable.id,
          date: serviceRecordsTable.date,
          description: serviceRecordsTable.description,
          companyName: serviceRecordsTable.companyName,
          technicianName: serviceRecordsTable.technicianName,
          cost: serviceRecordsTable.cost,
          nextServiceDate: serviceRecordsTable.nextServiceDate,
          verified: serviceRecordsTable.verified,
        })
        .from(serviceRecordsTable)
        .where(eq(serviceRecordsTable.assetId, assetId))
        .orderBy(desc(serviceRecordsTable.date))
    : null;

  res.json({
    assetId,
    registryId: registryIdFor(assetId),
    category: row.asset.category,
    hasActiveJob,
    myJobs: mine.map((j) => {
      // Address and phone go to the tech while the job is active, as in
      // /marketplace/jobs/assigned; finished jobs don't keep them.
      const active = ACTIVE_JOB_STATUSES.has(j.status);
      return {
        id: j.id,
        description: j.description,
        urgency: j.urgency,
        status: j.status,
        scheduledAt: j.scheduledAt,
        acceptedAt: j.acceptedAt,
        createdAt: j.createdAt,
        propertyAddress: active ? row.property.address : null,
        propertyCity: row.property.city,
        propertyState: row.property.state,
        contactPhone: active ? j.contactPhone : null,
      };
    }),
    // Same shape and redaction as GET /marketplace/jobs/open.
    openJobs: open.map((j) => ({
      id: j.id,
      description: j.description,
      urgency: j.urgency,
      status: j.status,
      assetName: row.asset.name,
      assetCategory: row.asset.category,
      city: row.property.city,
      state: row.property.state,
      zipCode: row.property.zipCode,
      latitude: j.latitude != null ? Number(j.latitude) : null,
      longitude: j.longitude != null ? Number(j.longitude) : null,
      createdAt: j.createdAt,
    })),
    asset: hasActiveJob
      ? {
          id: row.asset.id,
          name: row.asset.name,
          category: row.asset.category,
          brand: row.asset.brand,
          model: row.asset.model,
          serialNumber: row.asset.serialNumber,
          installDate: row.asset.installDate,
          warrantyExpiry: row.asset.warrantyExpiry,
          notes: row.asset.notes,
          retiredAt: row.asset.retiredAt,
        }
      : null,
    serviceHistory,
  });
});

export default router;
