import { Router } from "express";
import { db } from "@workspace/db";
import { propertiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  GetPropertyParams,
  UpdatePropertyParams,
  GetPropertySummaryParams,
} from "@workspace/api-zod";
import { assetsTable, maintenanceTasksTable, serviceRecordsTable } from "@workspace/db";
import { calcAssetScore, calcHealthScore } from "../health-score.js";

const router = Router();

router.get("/properties", async (req, res) => {
  const properties = await db.select().from(propertiesTable).orderBy(propertiesTable.createdAt);
  res.json(properties);
});

router.post("/properties", async (req, res) => {
  const body = CreatePropertyBody.parse(req.body);
  const [property] = await db.insert(propertiesTable).values({ ...body, userId: "demo-user" }).returning();
  res.status(201).json(property);
});

router.get("/properties/:propertyId", async (req, res) => {
  const { propertyId } = GetPropertyParams.parse(req.params);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, propertyId));
  if (!property) return res.status(404).json({ error: "Property not found" });
  res.json(property);
});

router.patch("/properties/:propertyId", async (req, res) => {
  const { propertyId } = UpdatePropertyParams.parse(req.params);
  const body = UpdatePropertyBody.parse(req.body);
  const [property] = await db
    .update(propertiesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(propertiesTable.id, propertyId))
    .returning();
  if (!property) return res.status(404).json({ error: "Property not found" });
  res.json(property);
});

router.get("/properties/:propertyId/summary", async (req, res) => {
  const { propertyId } = GetPropertySummaryParams.parse(req.params);

  const assets = await db.select().from(assetsTable).where(eq(assetsTable.propertyId, propertyId));
  const totalAssets = assets.length;
  const verifiedAssets = assets.filter((a) => a.status === "verified").length;

  const today = new Date().toISOString().split("T")[0]!;
  const tasks = await db
    .select({ task: maintenanceTasksTable, assetId: assetsTable.id })
    .from(maintenanceTasksTable)
    .innerJoin(assetsTable, eq(maintenanceTasksTable.assetId, assetsTable.id))
    .where(eq(assetsTable.propertyId, propertyId));

  const overdueTaskCount = tasks.filter((t) => t.task.nextDueDate < today && !t.task.completedAt).length;
  const upcomingTasks = tasks
    .filter((t) => t.task.nextDueDate >= today && !t.task.completedAt)
    .slice(0, 8)
    .map((t) => t.task);

  const categoryMap: Record<string, number> = {};
  for (const a of assets) {
    categoryMap[a.category] = (categoryMap[a.category] ?? 0) + 1;
  }
  const assetsByCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));

  // Health scoring
  const assetScores = assets.map((a) => calcAssetScore(a));
  const { score: healthScore, grade: healthGrade, assetAgeScore, overdueScore } = calcHealthScore(assetScores, overdueTaskCount);
  const criticalAssets = assetScores.filter((s) => s.score < 40);

  // Recent service records for this property (through assets)
  const assetIds = assets.map((a) => a.id);
  const recentRecords = assetIds.length > 0
    ? await db
        .select()
        .from(serviceRecordsTable)
        .where(eq(serviceRecordsTable.assetId, assetIds[0]!)) // simplified — gets records for first asset; real impl would use inArray
        .orderBy(desc(serviceRecordsTable.createdAt))
        .limit(5)
    : [];

  // Better: get recent records across all assets for the property
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
    upcomingTasks,
    assetsByCategory,
    assetScores,
    scoringBreakdown: { assetAgeScore, overdueScore, criticalAssets },
    recentRecords: allRecentRecords,
  });
});

export default router;
