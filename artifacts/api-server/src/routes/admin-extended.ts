import { Router } from "express";
import { db, propertiesTable, assetsTable, userProfilesTable, marketplaceJobsTable, serviceRecordsTable, subscriptionsTable } from "@workspace/db";
import { eq, ilike, or, sql, count } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();
const adminAuth = [requireAuth(), requireAdmin()];

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
