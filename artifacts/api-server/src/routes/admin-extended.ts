import { Router } from "express";
import { db, propertiesTable, assetsTable, userProfilesTable, marketplaceJobsTable, serviceRecordsTable, subscriptionsTable } from "@workspace/db";
import { eq, ilike, or, sql, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();
const adminAuth = [requireAuth(), requireAdmin()];

// ─── Backfill Properties ──────────────────────────────────────────────────────

router.post("/admin/backfill-properties", ...adminAuth, async (req, res) => {
  const apiKey = process.env.RENTCAST_API_KEY;

  // Step 1: Backfill owner_email via JOIN with user_profiles (pure SQL, fast)
  await db.execute(sql`
    UPDATE properties p
    SET owner_email = up.email
    FROM user_profiles up
    WHERE p.user_id = up.user_id
      AND p.owner_email IS NULL
      AND up.email IS NOT NULL
  `);

  // Step 2: Fetch properties still missing lat/lng
  const missing = await db
    .select({
      id: propertiesTable.id,
      address: propertiesTable.address,
      city: propertiesTable.city,
      state: propertiesTable.state,
      zipCode: propertiesTable.zipCode,
    })
    .from(propertiesTable)
    .where(isNull(propertiesTable.latitude));

  // Step 3: Re-count after owner_email update
  const afterEmailUpdate = await db
    .select({ id: propertiesTable.id, ownerEmail: propertiesTable.ownerEmail })
    .from(propertiesTable);

  let ownerEmailUpdated = afterEmailUpdate.filter((r) => r.ownerEmail).length;
  let latLngUpdated = 0;
  let errors = 0;

  const rows: Array<{
    id: string;
    address: string;
    ownerEmailUpdated: boolean;
    latLngUpdated: boolean;
    error?: string;
  }> = [];

  // Step 4: Geocode each property missing lat/lng via RentCast
  for (const prop of missing) {
    const fullAddress = [prop.address, prop.city, prop.state, prop.zipCode]
      .filter(Boolean)
      .join(", ");

    const row: (typeof rows)[0] = {
      id: prop.id,
      address: prop.address,
      ownerEmailUpdated: false,
      latLngUpdated: false,
    };

    if (!apiKey) {
      row.error = "RENTCAST_API_KEY not configured";
      errors++;
      rows.push(row);
      continue;
    }

    try {
      const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(fullAddress)}&limit=1`;
      const response = await fetch(url, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      });

      if (!response.ok) {
        const text = await response.text();
        req.log.warn({ id: prop.id, status: response.status, body: text }, "RentCast backfill failed");
        row.error = `RentCast ${response.status}: ${text.slice(0, 100)}`;
        errors++;
        rows.push(row);
        continue;
      }

      const data = (await response.json()) as any[];
      if (!data || data.length === 0) {
        row.error = "No RentCast match found";
        errors++;
        rows.push(row);
        continue;
      }

      const p = data[0];
      if (p.latitude != null && p.longitude != null) {
        await db
          .update(propertiesTable)
          .set({ latitude: p.latitude, longitude: p.longitude })
          .where(eq(propertiesTable.id, prop.id));
        row.latLngUpdated = true;
        latLngUpdated++;
      }
    } catch (err: any) {
      req.log.error({ id: prop.id, err: err.message }, "Backfill geocode error");
      row.error = err.message ?? "Unknown error";
      errors++;
    }

    rows.push(row);
  }

  res.json({
    total: afterEmailUpdate.length,
    ownerEmailUpdated,
    latLngUpdated,
    errors,
    rows,
  });
});

// ─── Properties ───────────────────────────────────────────────────────────────

const ListPropsQuery = z.object({ search: z.string().optional() });

router.get("/admin/properties", ...adminAuth, async (req, res) => {
  const { search } = ListPropsQuery.parse(req.query);

  const rows = await db
    .select({
      id: propertiesTable.id,
      name: propertiesTable.name,
      address: propertiesTable.address,
      city: propertiesTable.city,
      state: propertiesTable.state,
      yearBuilt: propertiesTable.yearBuilt,
      sqft: propertiesTable.sqft,
      photoUrl: propertiesTable.photoUrl,
      userId: propertiesTable.userId,
      createdAt: propertiesTable.createdAt,
      ownerFirstName: userProfilesTable.firstName,
      ownerLastName: userProfilesTable.lastName,
      ownerEmail: userProfilesTable.email,
      assetCount: sql<number>`cast(count(${assetsTable.id}) as int)`,
    })
    .from(propertiesTable)
    .leftJoin(userProfilesTable, eq(propertiesTable.userId, userProfilesTable.userId))
    .leftJoin(assetsTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(
      search
        ? or(
            ilike(propertiesTable.address, `%${search}%`),
            ilike(propertiesTable.name, `%${search}%`),
            ilike(propertiesTable.city, `%${search}%`),
          )
        : undefined,
    )
    .groupBy(
      propertiesTable.id,
      userProfilesTable.firstName,
      userProfilesTable.lastName,
      userProfilesTable.email,
    )
    .orderBy(propertiesTable.createdAt);

  res.json(
    rows.map((r) => ({
      ...r,
      ownerName:
        r.ownerFirstName || r.ownerLastName
          ? `${r.ownerFirstName ?? ""} ${r.ownerLastName ?? ""}`.trim()
          : null,
    })),
  );
});

// ─── Technicians ──────────────────────────────────────────────────────────────

router.get("/admin/technicians", ...adminAuth, async (_req, res) => {
  const rows = await db
    .select({
      userId: userProfilesTable.userId,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName,
      email: userProfilesTable.email,
      phone: userProfilesTable.phone,
      technicianNumber: userProfilesTable.technicianNumber,
      createdAt: userProfilesTable.createdAt,
      updatedAt: userProfilesTable.updatedAt,
      completedJobs: sql<number>`cast(count(distinct case when ${marketplaceJobsTable.status} = 'completed' then ${marketplaceJobsTable.id} end) as int)`,
      totalServiceRecords: sql<number>`cast(count(distinct ${serviceRecordsTable.id}) as int)`,
    })
    .from(userProfilesTable)
    .leftJoin(marketplaceJobsTable, eq(marketplaceJobsTable.technicianId, userProfilesTable.userId))
    .leftJoin(serviceRecordsTable, eq(serviceRecordsTable.casaServiceTechId, userProfilesTable.userId))
    .where(eq(userProfilesTable.role, "technician"))
    .groupBy(userProfilesTable.userId)
    .orderBy(userProfilesTable.createdAt);

  res.json(rows.map((r) => ({ ...r, role: "technician" })));
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get("/admin/analytics", ...adminAuth, async (_req, res) => {
  const [usersByMonth, recordsByMonth, jobsByStatus, subsByTier] = await Promise.all([
    db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') as label,
             CAST(COUNT(*) AS INT) as count
      FROM user_profiles
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `),
    db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') as label,
             CAST(COUNT(*) AS INT) as count
      FROM service_records
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `),
    db.execute(sql`
      SELECT status as label, CAST(COUNT(*) AS INT) as count
      FROM marketplace_jobs
      GROUP BY status
      ORDER BY count DESC
    `),
    db.execute(sql`
      SELECT tier as label, CAST(COUNT(*) AS INT) as count
      FROM subscriptions
      GROUP BY tier
      ORDER BY count DESC
    `),
  ]);

  res.json({
    usersByMonth: usersByMonth.rows,
    serviceRecordsByMonth: recordsByMonth.rows,
    jobsByStatus: jobsByStatus.rows,
    subscriptionsByTier: subsByTier.rows,
  });
});

export default router;
