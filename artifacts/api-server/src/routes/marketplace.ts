import { Router } from "express";
import { db } from "@workspace/db";
import {
  marketplaceJobsTable,
  assetsTable,
  propertiesTable,
  serviceRecordsTable,
  userProfilesTable,
  serviceWaitlistTable,
  type Property,
} from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import { CreateMarketplaceJobBody } from "@workspace/api-zod";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireTechnician, isTechnician } from "../middlewares/requireTechnician.js";
import { getAccessibleProperty, getOwnedAsset } from "../lib/access.js";
import { sendPushToUser } from "../lib/pushNotifications.js";
import { recordAuditInBackground } from "../lib/audit.js";
import { logger } from "../lib/logger.js";
import { checkServiceArea, getServiceArea, type ServiceAreaCheck } from "../lib/serviceArea.js";
import { allowedFrom, canTransition } from "../lib/jobTransitions.js";
import { isSameLocalDay, parseScheduleDate } from "../lib/jobSchedule.js";
import { timezoneForState } from "../lib/timezones.js";
import { notifyAdminsOfServiceRequest } from "../lib/serviceRequestNotifications.js";

const router = Router();

// Push a job update to the homeowner of the job's asset. Fire-and-forget; homes
// released after an owner deleted their account have no one to notify.
async function notifyHomeowner(
  assetId: string,
  jobId: string,
  message: (assetName: string) => { title: string; body: string },
): Promise<void> {
  const [row] = await db
    .select({ assetName: assetsTable.name, userId: propertiesTable.userId })
    .from(assetsTable)
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(eq(assetsTable.id, assetId))
    .limit(1);
  if (!row?.userId) return;
  await sendPushToUser(row.userId, { ...message(row.assetName), data: { screen: "job", jobId } });
}

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

// Where a home is, for the service-area check: its own coordinates when we
// have them, otherwise its city/zip geocoded. Also returns the city-level
// point stored on a job, which is all a technician sees before accepting.
async function locateProperty(property: Property): Promise<{
  home: { lat: number; lng: number } | null;
  cityLevel: { lat: number; lng: number } | null;
}> {
  const cityLevel = property.city && property.state
    ? await geocodeCity(property.city, property.state, property.zipCode)
    : null;
  const home = property.latitude != null && property.longitude != null
    ? { lat: property.latitude, lng: property.longitude }
    : cityLevel;
  return { home, cityLevel };
}

async function serviceAreaStatus(property: Property): Promise<ServiceAreaCheck> {
  const { home } = await locateProperty(property);
  return checkServiceArea(home);
}

// ── Service area ──────────────────────────────────────────────────────────
router.get("/service-area", requireAuth(), (_req, res) => {
  res.json(getServiceArea());
});

const ServiceAreaQuery = z.object({ propertyId: z.string().min(1) });

// Whether CasaService can take requests for a home, and whether the user is
// already on the waitlist for it.
router.get("/service-area/check", requireAuth(), async (req, res) => {
  const parsed = ServiceAreaQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "propertyId is required" });
    return;
  }
  const property = await getAccessibleProperty(parsed.data.propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const status = await serviceAreaStatus(property);
  const [waitlisted] = await db
    .select({ id: serviceWaitlistTable.id })
    .from(serviceWaitlistTable)
    .where(and(eq(serviceWaitlistTable.userId, req.userId), eq(serviceWaitlistTable.propertyId, property.id)))
    .limit(1);
  res.json({
    // An unknown location gets the benefit of the doubt; the admin email for
    // the request says it couldn't be checked.
    inServiceArea: status !== "outside",
    status,
    areaName: getServiceArea().name,
    onWaitlist: !!waitlisted,
  });
});

const WaitlistBody = z.object({ propertyId: z.string().min(1) });

router.post("/service-area/waitlist", requireAuth(), async (req, res) => {
  const parsed = WaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "propertyId is required" });
    return;
  }
  const property = await getAccessibleProperty(parsed.data.propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const [profile] = await db
    .select({ email: userProfilesTable.email })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId))
    .limit(1);
  await db
    .insert(serviceWaitlistTable)
    .values({
      userId: req.userId,
      propertyId: property.id,
      email: profile?.email ?? null,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
    })
    .onConflictDoNothing();
  res.status(201).json({ ok: true, onWaitlist: true });
});

// ── Homeowner: list their own posted jobs ─────────────────────────────────
router.get("/marketplace/jobs", requireAuth(), async (req, res) => {
  const userProperties = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.userId, req.userId));

  if (userProperties.length === 0) {
    res.json([]);
    return;
  }

  const propertyIds = userProperties.map((p) => p.id);
  const userAssets = await db
    .select()
    .from(assetsTable)
    .where(inArray(assetsTable.propertyId, propertyIds));

  if (userAssets.length === 0) {
    res.json([]);
    return;
  }

  const assetIds = userAssets.map((a) => a.id);

  const jobs = await db
    .select({
      id: marketplaceJobsTable.id,
      assetId: marketplaceJobsTable.assetId,
      propertyId: assetsTable.propertyId,
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
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  if (asset.retiredAt) {
    res.status(409).json({ error: "This asset is retired. Reactivate it first." });
    return;
  }

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, asset.propertyId));
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  // CasaService only works in its service area. The apps check first and
  // offer the waitlist, but this is the check that counts.
  const { home, cityLevel } = await locateProperty(property);
  const areaStatus = checkServiceArea(home);
  if (areaStatus === "outside") {
    res.status(422).json({
      error: `Not in your area yet. CasaService currently serves the ${getServiceArea().name}. Join the waitlist to hear when we reach you.`,
      code: "outside_service_area",
    });
    return;
  }
  const lat = cityLevel?.lat ?? null;
  const lng = cityLevel?.lng ?? null;

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

  notifyAdminsOfServiceRequest({
    jobId: job!.id,
    assetName: asset.name,
    assetCategory: asset.category,
    description: job!.description,
    urgency: job!.urgency,
    city: property.city,
    state: property.state,
    zipCode: property.zipCode,
    locationVerified: areaStatus === "inside",
  }).catch((err) => logger.error({ err, jobId: job!.id }, "New service request admin notification failed"));

  res.status(201).json({
    ...job,
    propertyId: property.id,
    assetName: asset.name,
    assetCategory: asset.category,
    assetBrand: asset.brand,
    assetModel: asset.model,
    assetSerialNumber: asset.serialNumber,
    city: property.city,
    state: property.state,
  });
});

// ── Technician: list all open jobs with location ──────────────────────────
router.get("/marketplace/jobs/open", requireAuth(), requireTechnician(), async (req, res) => {
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
      // City-level coordinates geocoded when the job was posted — never the
      // property's own lat/lng, which would reveal the address before accept.
      latitude: marketplaceJobsTable.latitude,
      longitude: marketplaceJobsTable.longitude,
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
router.get("/marketplace/jobs/assigned", requireAuth(), requireTechnician(), async (req, res) => {
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
        inArray(marketplaceJobsTable.status, ["claimed", "en_route", "arrived"])
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

  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Visible to the homeowner (and their collaborators), the technician who
  // accepted it, and — while it's still open — any technician weighing it up.
  const isAcceptedByMe = row.job.technicianId === req.userId;
  const canView =
    isAcceptedByMe ||
    (row.job.status === "open" && (await isTechnician(req.userId))) ||
    (await getAccessibleProperty(row.property.id, req.userId)) !== null;
  if (!canView) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // A technician still weighing up an open job sees what the system is (type,
  // brand, model, serial, age) but not the home's history, costs, receipts or
  // notes; those unlock once they take the job, matching the QR scan rules.
  const canSeeHistory = isAcceptedByMe || (await getAccessibleProperty(row.property.id, req.userId)) !== null;
  const serviceHistory = canSeeHistory
    ? await db
        .select()
        .from(serviceRecordsTable)
        .where(eq(serviceRecordsTable.assetId, row.asset.id))
        .orderBy(serviceRecordsTable.date)
    : [];

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
    assetNotes: canSeeHistory ? row.asset.notes : null,
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

router.patch("/marketplace/jobs/:jobId/schedule", requireAuth(), requireTechnician(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);
  const parsedBody = ScheduleBody.safeParse(req.body);
  const newDate = parsedBody.success ? parseScheduleDate(parsedBody.data.scheduledAt) : null;
  if (!newDate) {
    res.status(400).json({ error: "scheduledAt must be a valid date and time" });
    return;
  }

  const [row] = await db
    .select({ job: marketplaceJobsTable, state: propertiesTable.state })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(
      and(
        eq(marketplaceJobsTable.id, jobId),
        eq(marketplaceJobsTable.technicianId, req.userId)
      )
    );

  if (!row) {
    res.status(404).json({ error: "Job not found or not assigned to you" });
    return;
  }
  const job = row.job;
  if (!canTransition(job.status, "schedule")) {
    res.status(409).json({ error: "This job can no longer be rescheduled" });
    return;
  }

  const [updated] = await db
    .update(marketplaceJobsTable)
    .set({ scheduledAt: newDate })
    .where(and(eq(marketplaceJobsTable.id, jobId), inArray(marketplaceJobsTable.status, allowedFrom("schedule"))))
    .returning({ id: marketplaceJobsTable.id });
  if (!updated) {
    res.status(409).json({ error: "This job can no longer be rescheduled" });
    return;
  }

  const dateStr = newDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezoneForState(row.state),
  });
  notifyHomeowner(job.assetId, jobId, (name) => ({
    title: "Service Scheduled",
    body: `Your ${name} service has been scheduled for ${dateStr}.`,
  })).catch(() => {});

  res.json({ ok: true, scheduledAt: newDate.toISOString() });
});

// ── Technician: on the way ────────────────────────────────────────────────
router.post("/marketplace/jobs/:jobId/en-route", requireAuth(), requireTechnician(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);

  const [row] = await db
    .select({ job: marketplaceJobsTable, state: propertiesTable.state })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(and(eq(marketplaceJobsTable.id, jobId), eq(marketplaceJobsTable.technicianId, req.userId)));

  if (!row) {
    res.status(404).json({ error: "Job not found or not assigned to you" });
    return;
  }
  const job = row.job;
  if (!canTransition(job.status, "en_route")) {
    res.status(400).json({ error: "Job must be in claimed status" });
    return;
  }
  if (!job.scheduledAt) {
    res.status(400).json({ error: "No service date set" });
    return;
  }

  // "Today" is the home's calendar day, not the server's (UTC).
  if (!isSameLocalDay(job.scheduledAt, new Date(), timezoneForState(row.state))) {
    res.status(400).json({ error: "On the Way is only available on the day of the appointment" });
    return;
  }

  const [updated] = await db
    .update(marketplaceJobsTable)
    .set({ status: "en_route" })
    .where(and(eq(marketplaceJobsTable.id, jobId), inArray(marketplaceJobsTable.status, allowedFrom("en_route"))))
    .returning({ id: marketplaceJobsTable.id });
  if (!updated) {
    res.status(409).json({ error: "Job status changed; refresh and try again" });
    return;
  }

  notifyHomeowner(job.assetId, jobId, (name) => ({
    title: "Technician On the Way",
    body: `Your technician is heading to you now for the ${name} service.`,
  })).catch(() => {});

  res.json({ ok: true });
});

// ── Technician: arrived ───────────────────────────────────────────────────
router.post("/marketplace/jobs/:jobId/arrived", requireAuth(), requireTechnician(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);

  const [job] = await db
    .select()
    .from(marketplaceJobsTable)
    .where(and(eq(marketplaceJobsTable.id, jobId), eq(marketplaceJobsTable.technicianId, req.userId)));

  if (!job) {
    res.status(404).json({ error: "Job not found or not assigned to you" });
    return;
  }
  if (!canTransition(job.status, "arrive")) {
    res.status(400).json({ error: "Job must be in en_route status" });
    return;
  }

  const [updated] = await db
    .update(marketplaceJobsTable)
    .set({ status: "arrived" })
    .where(and(eq(marketplaceJobsTable.id, jobId), inArray(marketplaceJobsTable.status, allowedFrom("arrive"))))
    .returning({ id: marketplaceJobsTable.id });
  if (!updated) {
    res.status(409).json({ error: "Job status changed; refresh and try again" });
    return;
  }

  notifyHomeowner(job.assetId, jobId, (name) => ({
    title: "Technician Has Arrived",
    body: `Your technician has arrived for the ${name} service.`,
  })).catch(() => {});

  res.json({ ok: true });
});

// ── Technician: complete a job ────────────────────────────────────────────
const CompleteBody = z.object({
  workSummary: z.string().min(1),
  cost: z.number().optional(),
  nextServiceDate: z.string().optional(),
});

router.post("/marketplace/jobs/:jobId/complete", requireAuth(), requireTechnician(), async (req, res) => {
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

  if (!row) {
    res.status(404).json({ error: "Job not found or not assigned to you" });
    return;
  }
  if (!canTransition(row.job.status, "complete")) {
    res.status(400).json({ error: "Job cannot be completed from its current status" });
    return;
  }
  if (!row.job.scheduledAt) {
    res.status(400).json({ error: "A service date must be set before marking complete" });
    return;
  }

  const [techProfile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId));

  const firstName = techProfile?.firstName ?? "";
  const lastInitial = techProfile?.lastName?.[0] ?? "";
  const techDisplayName = firstName
    ? `${firstName}${lastInitial ? ` ${lastInitial}` : ""} Technician`
    : "Technician";

  // Flip the status first and only if it's still completable, so a double
  // tap can't write two verified records.
  const [completed] = await db
    .update(marketplaceJobsTable)
    .set({ status: "completed" })
    .where(and(eq(marketplaceJobsTable.id, jobId), inArray(marketplaceJobsTable.status, allowedFrom("complete"))))
    .returning({ id: marketplaceJobsTable.id });
  if (!completed) {
    res.status(409).json({ error: "Job status changed; refresh and try again" });
    return;
  }

  const serviceDate = row.job.scheduledAt.toISOString().slice(0, 10);

  const [serviceRecord] = await db
    .insert(serviceRecordsTable)
    .values({
      assetId: row.asset.id,
      date: serviceDate,
      description: body.workSummary,
      companyName: "CasaService",
      technicianName: techDisplayName,
      technicianNumber: techProfile?.technicianNumber ?? null,
      cost: body.cost != null ? String(body.cost) : null,
      nextServiceDate: body.nextServiceDate ?? null,
      verified: true,
      casaServiceTechId: req.userId,
      createdByUserId: req.userId,
    })
    .returning();

  // The asset now has CasaService-verified history.
  await db
    .update(assetsTable)
    .set({ status: "verified", updatedAt: new Date() })
    .where(eq(assetsTable.id, row.asset.id));
  recordAuditInBackground({
    actorUserId: req.userId,
    action: "service_record.verified_by_casaservice",
    entityType: "service_record",
    entityId: serviceRecord!.id,
    propertyId: row.asset.propertyId,
    details: { assetId: row.asset.id, jobId, technicianNumber: techProfile?.technicianNumber ?? null },
  });

  notifyHomeowner(row.asset.id, jobId, (name) => ({
    title: "Service Complete ✓",
    body: `Your ${name} service has been completed.`,
  })).catch(() => {});

  res.json({ ok: true, serviceRecordId: serviceRecord!.id });
});

// ── Technician: accept a job ──────────────────────────────────────────────
router.post("/marketplace/jobs/:jobId/accept", requireAuth(), requireTechnician(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);

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
    // Conditional on still being open, so two technicians accepting at the
    // same moment can't both claim the job (and both receive the address).
    .where(and(eq(marketplaceJobsTable.id, jobId), inArray(marketplaceJobsTable.status, allowedFrom("accept"))))
    .returning();

  if (!updatedJob) {
    res.status(404).json({ error: "Job not found or already claimed" });
    return;
  }

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

  if (!row) {
    res.status(404).json({ error: "Row not found" });
    return;
  }

  // Notify homeowner that a tech has claimed the job
  notifyHomeowner(row.asset.id, jobId, (name) => ({
    title: "Technician Claimed Your Job",
    body: `${techName} has claimed your ${name} job.`,
  })).catch(() => {});

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

// ── Homeowner: cancel a request ───────────────────────────────────────────
// Allowed until the technician sets off. Owners and collaborators with access
// to the home can cancel.
const CancelBody = z.object({ reason: z.string().max(500).optional() }).optional();

router.post("/marketplace/jobs/:jobId/cancel", requireAuth(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);
  const body = CancelBody.safeParse(req.body ?? undefined);
  const reason = body.success ? body.data?.reason?.trim() || null : null;

  const [row] = await db
    .select({ job: marketplaceJobsTable, assetName: assetsTable.name, propertyId: propertiesTable.id })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(eq(marketplaceJobsTable.id, jobId));

  if (!row || !(await getAccessibleProperty(row.propertyId, req.userId))) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (!canTransition(row.job.status, "cancel")) {
    res.status(409).json({
      error: row.job.status === "en_route" || row.job.status === "arrived"
        ? "Your technician is already on the way. Call them or contact us to cancel."
        : "This request can no longer be cancelled",
    });
    return;
  }

  const [cancelled] = await db
    .update(marketplaceJobsTable)
    .set({ status: "cancelled" })
    .where(and(eq(marketplaceJobsTable.id, jobId), inArray(marketplaceJobsTable.status, allowedFrom("cancel"))))
    .returning();
  if (!cancelled) {
    res.status(409).json({ error: "This request can no longer be cancelled" });
    return;
  }

  recordAuditInBackground({
    actorUserId: req.userId,
    action: "marketplace_job.cancelled",
    entityType: "marketplace_job",
    entityId: jobId,
    propertyId: row.propertyId,
    details: { previousStatus: row.job.status, technicianId: row.job.technicianId, reason },
  });

  if (row.job.technicianId) {
    sendPushToUser(row.job.technicianId, {
      title: "Job Cancelled",
      body: `The homeowner cancelled the ${row.assetName} job.`,
    }).catch(() => {});
  }

  res.json({ ok: true, status: cancelled.status });
});

// ── Technician: release a job back to the open pool ───────────────────────
// For a technician who accepted a job and can't do it. Only before they set
// off; the job goes back to open with no technician or date.
router.post("/marketplace/jobs/:jobId/release", requireAuth(), requireTechnician(), async (req, res) => {
  const { jobId } = JobParams.parse(req.params);

  const [row] = await db
    .select({ job: marketplaceJobsTable, propertyId: assetsTable.propertyId })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .where(and(eq(marketplaceJobsTable.id, jobId), eq(marketplaceJobsTable.technicianId, req.userId)));

  if (!row) {
    res.status(404).json({ error: "Job not found or not assigned to you" });
    return;
  }
  if (!canTransition(row.job.status, "release")) {
    res.status(409).json({ error: "Only accepted jobs you haven't set off for can be released" });
    return;
  }

  const [released] = await db
    .update(marketplaceJobsTable)
    .set({
      status: "open",
      technicianId: null,
      technicianNumber: null,
      technicianName: null,
      acceptedAt: null,
      scheduledAt: null,
    })
    .where(
      and(
        eq(marketplaceJobsTable.id, jobId),
        eq(marketplaceJobsTable.technicianId, req.userId),
        inArray(marketplaceJobsTable.status, allowedFrom("release")),
      ),
    )
    .returning({ id: marketplaceJobsTable.id });
  if (!released) {
    res.status(409).json({ error: "Job status changed; refresh and try again" });
    return;
  }

  recordAuditInBackground({
    actorUserId: req.userId,
    action: "marketplace_job.released",
    entityType: "marketplace_job",
    entityId: jobId,
    propertyId: row.propertyId,
    details: { scheduledAt: row.job.scheduledAt?.toISOString() ?? null },
  });

  notifyHomeowner(row.job.assetId, jobId, (name) => ({
    title: "Finding Another Technician",
    body: `Your technician can no longer make the ${name} job. We're assigning someone else.`,
  })).catch(() => {});

  res.json({ ok: true, status: "open" });
});

export default router;
