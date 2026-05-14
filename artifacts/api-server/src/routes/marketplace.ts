import { Router } from "express";
import { db } from "@workspace/db";
import {
  marketplaceJobsTable,
  assetsTable,
  propertiesTable,
  serviceRecordsTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import { CreateMarketplaceJobBody } from "@workspace/api-zod";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedAsset } from "../lib/access.js";

const router = Router();

// ── Geocode a city/state/zip string via Nominatim ─────────────────────────
async function geocodeCity(city: string, state: string, zip?: string | null): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = [zip, city, state, "USA"].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "CasaDossier/1.0 (info@casadossier.com)" } });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0]!.lat), lng: parseFloat(data[0]!.lon) };
  } catch {
    return null;
  }
}

// ── Homeowner: list their own posted jobs ─────────────────────────────────
router.get("/marketplace/jobs", requireAuth(), async (req, res) => {
  const userProperties = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.userId, req.userId));

  if (userProperties.length === 0) return res.json([]);

  const propertyIds = userProperties.map((p) => p.id);
  const userAssets = await db
    .select()
    .from(assetsTable)
    .where(inArray(assetsTable.propertyId, propertyIds));

  if (userAssets.length === 0) return res.json([]);

  const assetIds = userAssets.map((a) => a.id);

  const jobs = await db
    .select({
      id: marketplaceJobsTable.id,
      assetId: marketplaceJobsTable.assetId,
      assetName: assetsTable.name,
      assetCategory: assetsTable.category,
      assetBrand: assetsTable.brand,
      assetModel: assetsTable.model,
      assetSerialNumber: assetsTable.serialNumber,
      description: marketplaceJobsTable.description,
      urgency: marketplaceJobsTable.urgency,
      status: marketplaceJobsTable.status,
      city: propertiesTable.city,
      state: propertiesTable.state,
      technicianName: marketplaceJobsTable.technicianName,
      technicianPhone: userProfilesTable.phone,
      scheduledAt: marketplaceJobsTable.scheduledAt,
      acceptedAt: marketplaceJobsTable.acceptedAt,
      createdAt: marketplaceJobsTable.createdAt,
    })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .leftJoin(userProfilesTable, eq(marketplaceJobsTable.technicianId, userProfilesTable.userId))
    .where(inArray(marketplaceJobsTable.assetId, assetIds))
    .orderBy(marketplaceJobsTable.createdAt);

  res.json(jobs);
});

// ── Homeowner: post a job ─────────────────────────────────────────────────
router.post("/marketplace/jobs", requireAuth(), async (req, res) => {
  const body = CreateMarketplaceJobBody.parse(req.body);

  const asset = await getOwnedAsset(body.assetId, req.userId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, asset.propertyId));

  let lat: number | null = null;
  let lng: number | null = null;
  if (property?.city && property?.state) {
    const coords = await geocodeCity(property.city, property.state, property.zipCode);
    if (coords) { lat = coords.lat; lng = coords.lng; }
  }

  const [job] = await db
    .insert(marketplaceJobsTable)
    .values({
      assetId: body.assetId,
      description: body.description,
      urgency: body.urgency ?? "medium",
      contactPhone: body.contactPhone ?? null,
      latitude: lat != null ? String(lat) : null,
      longitude: lng != null ? String(lng) : null,
    })
    .returning();

  res.status(201).json({
    ...job,
    assetName: asset.name,
    assetCategory: asset.category,
    assetBrand: asset.brand,
    assetModel: asset.model,
    assetSerialNumber: asset.serialNumber,
    city: property?.city ?? null,
    state: property?.state ?? null,
  });
});

// ── Technician: list all open jobs with location ──────────────────────────
router.get("/marketplace/jobs/open", requireAuth(), async (req, res) => {
  const jobs = await db
    .select({
      id: marketplaceJobsTable.id,
      description: marketplaceJobsTable.description,
      urgency: marketplaceJobsTable.urgency,
      status: marketplaceJobsTable.status,
      assetName: assetsTable.name,
      assetCategory: assetsTable.category,
      city: propertiesTable.city,
      state: propertiesTable.state,
      zipCode: propertiesTable.zipCode,
      latitude: propertiesTable.latitude,
      longitude: propertiesTable.longitude,
      createdAt: marketplaceJobsTable.createdAt,
    })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(eq(marketplaceJobsTable.status, "open"))
    .orderBy(marketplaceJobsTable.createdAt);

  res.json(
    jobs.map((j) => ({
      ...j,
      latitude: j.latitude != null ? Number(j.latitude) : null,
      longitude: j.longitude != null ? Number(j.longitude) : null,
    }))
  );
});

// ── Technician: list jobs assigned to them ────────────────────────────────
router.get("/marketplace/jobs/assigned", requireAuth(), async (req, res) => {
  const rows = await db
    .select({
      id: marketplaceJobsTable.id,
      description: marketplaceJobsTable.description,
      urgency: marketplaceJobsTable.urgency,
      status: marketplaceJobsTable.status,
      assetName: assetsTable.name,
      assetCategory: assetsTable.category,
      assetBrand: assetsTable.brand,
      assetModel: assetsTable.model,
      propertyAddress: propertiesTable.address,
      propertyCity: propertiesTable.city,
      propertyState: propertiesTable.state,
      propertyZipCode: propertiesTable.zipCode,
      contactPhone: marketplaceJobsTable.contactPhone,
      scheduledAt: marketplaceJobsTable.scheduledAt,
      acceptedAt: marketplaceJobsTable.acceptedAt,
      createdAt: marketplaceJobsTable.createdAt,
    })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(
      and(
        eq(marketplaceJobsTable.technicianId, req.userId),
        eq(marketplaceJobsTable.status, "claimed")
      )
    )
    .orderBy(marketplaceJobsTable.acceptedAt);

  res.json(rows);
});

// ── Technician: get full job details ──────────────────────────────────────
const JobParams = z.object({ jobId: z.string() });

router.get("/marketplace/jobs/:jobId/details", requireAuth(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);

  const [row] = await db
    .select({
      job: marketplaceJobsTable,
      asset: assetsTable,
      property: propertiesTable,
    })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(eq(marketplaceJobsTable.id, jobId));

  if (!row) return res.status(404).json({ error: "Job not found" });

  const serviceHistory = await db
    .select()
    .from(serviceRecordsTable)
    .where(eq(serviceRecordsTable.assetId, row.asset.id))
    .orderBy(serviceRecordsTable.date);

  const isAcceptedByMe = row.job.technicianId === req.userId;

  res.json({
    id: row.job.id,
    description: row.job.description,
    urgency: row.job.urgency,
    status: row.job.status,
    assetId: row.asset.id,
    assetName: row.asset.name,
    assetCategory: row.asset.category,
    assetBrand: row.asset.brand,
    assetModel: row.asset.model,
    assetSerialNumber: row.asset.serialNumber,
    assetInstallDate: row.asset.installDate,
    assetWarrantyExpiry: row.asset.warrantyExpiry,
    assetNotes: row.asset.notes,
    propertyAddress: isAcceptedByMe ? row.property.address : null,
    propertyCity: row.property.city,
    propertyState: row.property.state,
    propertyZipCode: row.property.zipCode,
    propertyYearBuilt: row.property.yearBuilt,
    serviceHistory,
    contactPhone: isAcceptedByMe ? row.job.contactPhone : null,
    technicianId: row.job.technicianId,
    scheduledAt: row.job.scheduledAt,
    latitude: row.job.latitude != null ? parseFloat(String(row.job.latitude)) : null,
    longitude: row.job.longitude != null ? parseFloat(String(row.job.longitude)) : null,
    createdAt: row.job.createdAt,
    acceptedAt: row.job.acceptedAt,
  });
});

// ── Technician: schedule a job ────────────────────────────────────────────
const ScheduleBody = z.object({ scheduledAt: z.string() });

router.patch("/marketplace/jobs/:jobId/schedule", requireAuth(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);
  const { scheduledAt } = ScheduleBody.parse(req.body);

  const [job] = await db
    .select()
    .from(marketplaceJobsTable)
    .where(
      and(
        eq(marketplaceJobsTable.id, jobId),
        eq(marketplaceJobsTable.technicianId, req.userId)
      )
    );

  if (!job) return res.status(404).json({ error: "Job not found or not assigned to you" });

  const newDate = new Date(scheduledAt);
  await db
    .update(marketplaceJobsTable)
    .set({ scheduledAt: newDate })
    .where(eq(marketplaceJobsTable.id, jobId));

  res.json({ ok: true, scheduledAt: newDate.toISOString() });
});

// ── Technician: complete a job ────────────────────────────────────────────
const CompleteBody = z.object({
  workSummary: z.string().min(1),
  cost: z.number().optional(),
  nextServiceDate: z.string().optional(),
});

router.post("/marketplace/jobs/:jobId/complete", requireAuth(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);
  const body = CompleteBody.parse(req.body);

  const [row] = await db
    .select({
      job: marketplaceJobsTable,
      asset: assetsTable,
    })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .where(
      and(
        eq(marketplaceJobsTable.id, jobId),
        eq(marketplaceJobsTable.technicianId, req.userId)
      )
    );

  if (!row) return res.status(404).json({ error: "Job not found or not assigned to you" });
  if (row.job.status !== "claimed") return res.status(400).json({ error: "Job must be in claimed status to complete" });
  if (!row.job.scheduledAt) return res.status(400).json({ error: "A service date must be set before marking complete" });

  const [techProfile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId));

  const techName = techProfile
    ? `${techProfile.firstName} ${techProfile.lastName}`.trim()
    : "Technician";

  const serviceDate = row.job.scheduledAt.toISOString().slice(0, 10);

  const [serviceRecord] = await db
    .insert(serviceRecordsTable)
    .values({
      assetId: row.asset.id,
      date: serviceDate,
      description: body.workSummary,
      technicianName: techName,
      technicianNumber: techProfile?.technicianNumber ?? null,
      cost: body.cost != null ? String(body.cost) : null,
      nextServiceDate: body.nextServiceDate ?? null,
      verified: true,
      casaServiceTechId: req.userId,
    })
    .returning();

  await db
    .update(marketplaceJobsTable)
    .set({ status: "completed" })
    .where(eq(marketplaceJobsTable.id, jobId));

  res.json({ ok: true, serviceRecordId: serviceRecord!.id });
});

// ── Technician: accept a job ──────────────────────────────────────────────
router.post("/marketplace/jobs/:jobId/accept", requireAuth(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);

  const [job] = await db
    .select()
    .from(marketplaceJobsTable)
    .where(and(eq(marketplaceJobsTable.id, jobId), eq(marketplaceJobsTable.status, "open")));

  if (!job) return res.status(404).json({ error: "Job not found or already claimed" });

  // Look up the technician's profile for their name and number
  const [techProfile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId));

  const techName = techProfile
    ? `${techProfile.firstName} ${techProfile.lastName}`.trim()
    : "Technician";

  const [updatedJob] = await db
    .update(marketplaceJobsTable)
    .set({
      status: "claimed",
      technicianId: req.userId,
      technicianNumber: techProfile?.technicianNumber ?? null,
      technicianName: techName,
      acceptedAt: new Date(),
    })
    .where(eq(marketplaceJobsTable.id, jobId))
    .returning();

  // Fetch full details to return
  const [row] = await db
    .select({
      job: marketplaceJobsTable,
      asset: assetsTable,
      property: propertiesTable,
    })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(eq(marketplaceJobsTable.id, jobId));

  const serviceHistory = row
    ? await db
        .select()
        .from(serviceRecordsTable)
        .where(eq(serviceRecordsTable.assetId, row.asset.id))
        .orderBy(serviceRecordsTable.date)
    : [];

  if (!row) return res.status(404).json({ error: "Row not found" });

  res.json({
    id: row.job.id,
    description: row.job.description,
    urgency: row.job.urgency,
    status: row.job.status,
    assetId: row.asset.id,
    assetName: row.asset.name,
    assetCategory: row.asset.category,
    assetBrand: row.asset.brand,
    assetModel: row.asset.model,
    assetSerialNumber: row.asset.serialNumber,
    assetInstallDate: row.asset.installDate,
    assetWarrantyExpiry: row.asset.warrantyExpiry,
    assetNotes: row.asset.notes,
    propertyAddress: row.property.address,
    propertyCity: row.property.city,
    propertyState: row.property.state,
    propertyZipCode: row.property.zipCode,
    propertyYearBuilt: row.property.yearBuilt,
    serviceHistory,
    contactPhone: updatedJob?.contactPhone ?? null,
    technicianId: row.job.technicianId,
    scheduledAt: row.job.scheduledAt,
    latitude: row.job.latitude != null ? parseFloat(String(row.job.latitude)) : null,
    longitude: row.job.longitude != null ? parseFloat(String(row.job.longitude)) : null,
    createdAt: row.job.createdAt,
    acceptedAt: row.job.acceptedAt,
  });
});

export default router;
