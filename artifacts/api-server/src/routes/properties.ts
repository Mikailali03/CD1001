import { Router } from "express";
import { db } from "@workspace/db";
import { propertiesTable, subscriptionsTable, propertyCollaboratorsTable, TIER_PROPERTY_LIMITS } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  GetPropertyParams,
  UpdatePropertyParams,
  GetPropertySummaryParams,
} from "@workspace/api-zod";
import { assetsTable, maintenanceTasksTable, serviceRecordsTable } from "@workspace/db";
import { calcAssetScore, calcHealthScore } from "../health-score.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedProperty } from "../lib/access.js";
import { clerkClient } from "@clerk/express";

const router = Router();

router.get("/properties", requireAuth(), async (req, res) => {
  const [ownedProperties, collabRows] = await Promise.all([
    db
      .select()
      .from(propertiesTable)
      .where(eq(propertiesTable.userId, req.userId))
      .orderBy(propertiesTable.createdAt),
    db
      .select({ property: propertiesTable })
      .from(propertyCollaboratorsTable)
      .innerJoin(propertiesTable, eq(propertyCollaboratorsTable.propertyId, propertiesTable.id))
      .where(
        and(
          eq(propertyCollaboratorsTable.acceptedUserId, req.userId!),
          eq(propertyCollaboratorsTable.status, "accepted"),
        )
      ),
  ]);

  const ownedIds = new Set(ownedProperties.map((p) => p.id));
  const collabProperties = collabRows
    .map((r) => r.property)
    .filter((p) => !ownedIds.has(p.id));

  res.json([...ownedProperties, ...collabProperties]);
});

router.post("/properties", requireAuth(), async (req, res) => {
  const body = CreatePropertyBody.parse(req.body);

  // Enforce property limit based on subscription tier
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, req.userId)).limit(1);
  const tier = sub?.tier ?? "essential";
  const limit = TIER_PROPERTY_LIMITS[tier] ?? 1;

  const [{ total }] = await db
    .select({ total: count() })
    .from(propertiesTable)
    .where(eq(propertiesTable.userId, req.userId));

  if ((total ?? 0) >= limit) {
    return res.status(403).json({ error: "property_limit_reached", tier, limit });
  }

  // Fetch owner email from Clerk (best-effort — doesn't block creation)
  let ownerEmail: string | null = null;
  if (req.userId !== "demo-user") {
    try {
      const clerkUser = await clerkClient.users.getUser(req.userId);
      ownerEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;
    } catch {
      // Non-fatal — property still gets created without email
    }
  }

  const [property] = await db
    .insert(propertiesTable)
    .values({ ...body, userId: req.userId, ownerEmail })
    .returning();
  res.status(201).json(property);
});

router.get("/properties/:propertyId", requireAuth(), async (req, res) => {
  const { propertyId } = GetPropertyParams.parse(req.params);
  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });
  res.json(property);
});

router.patch("/properties/:propertyId", requireAuth(), async (req, res) => {
  const { propertyId } = UpdatePropertyParams.parse(req.params);
  const body = UpdatePropertyBody.parse(req.body);
  const existing = await getOwnedProperty(propertyId, req.userId);
  if (!existing) return res.status(404).json({ error: "Property not found" });
  const [property] = await db
    .update(propertiesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(propertiesTable.id, propertyId), eq(propertiesTable.userId, req.userId)))
    .returning();
  if (!property) return res.status(404).json({ error: "Property not found" });
  res.json(property);
});

router.get("/properties/:propertyId/summary", requireAuth(), async (req, res) => {
  const { propertyId } = GetPropertySummaryParams.parse(req.params);

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const assets = await db.select().from(assetsTable).where(eq(assetsTable.propertyId, propertyId));
  const totalAssets = assets.length;
  const verifiedAssets = assets.filter((a) => a.status === "verified").length;

  const today = new Date().toISOString().split("T")[0]!;
  const tasks = await db
    .select({ task: maintenanceTasksTable, assetId: assetsTable.id, assetName: assetsTable.name })
    .from(maintenanceTasksTable)
    .innerJoin(assetsTable, eq(maintenanceTasksTable.assetId, assetsTable.id))
    .where(eq(assetsTable.propertyId, propertyId));

  const pendingTasks = tasks.filter((t) => !t.task.completedAt);
  const overdueTasks = pendingTasks
    .filter((t) => t.task.nextDueDate < today)
    .sort((a, b) => a.task.nextDueDate.localeCompare(b.task.nextDueDate))
    .map((t) => ({ ...t.task, assetName: t.assetName }));
  const overdueTaskCount = overdueTasks.length;
  const upcomingTasks = pendingTasks
    .filter((t) => t.task.nextDueDate >= today)
    .sort((a, b) => a.task.nextDueDate.localeCompare(b.task.nextDueDate))
    .slice(0, 8)
    .map((t) => ({ ...t.task, assetName: t.assetName }));

  const categoryMap: Record<string, number> = {};
  for (const a of assets) {
    categoryMap[a.category] = (categoryMap[a.category] ?? 0) + 1;
  }
  const assetsByCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));

  const assetScores = assets.map((a) => calcAssetScore(a));
  const { score: healthScore, grade: healthGrade, assetAgeScore, overdueScore } = calcHealthScore(assetScores, overdueTaskCount);
  const criticalAssets = assetScores.filter((s) => s.score < 40);

  const allRecentRecords = await db
    .select({
      id: serviceRecordsTable.id,
      assetId: serviceRecordsTable.assetId,
      description: serviceRecordsTable.description,
      date: serviceRecordsTable.date,
      technicianName: serviceRecordsTable.technicianName,
      companyName: serviceRecordsTable.companyName,
      cost: serviceRecordsTable.cost,
      createdAt: serviceRecordsTable.createdAt,
      assetName: assetsTable.name,
    })
    .from(serviceRecordsTable)
    .innerJoin(assetsTable, eq(serviceRecordsTable.assetId, assetsTable.id))
    .where(eq(assetsTable.propertyId, propertyId))
    .orderBy(desc(serviceRecordsTable.createdAt))
    .limit(5);

  res.json({
    propertyId,
    healthScore,
    healthGrade,
    totalAssets,
    verifiedAssets,
    overdueTaskCount,
    overdueTasks,
    upcomingTasks,
    assetsByCategory,
    assetScores,
    scoringBreakdown: { assetAgeScore, overdueScore, criticalAssets },
    recentRecords: allRecentRecords,
  });
});

export default router;
