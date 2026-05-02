import { Router } from "express";
import { db } from "@workspace/db";
import {
  propertiesTable,
  assetsTable,
  maintenanceTasksTable,
  serviceRecordsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { calcAssetScore, calcHealthScore } from "../health-score.js";

const router = Router();

router.get("/dashboard", async (req, res) => {
  const properties = await db.select().from(propertiesTable);
  const assets = await db.select().from(assetsTable);

  const today = new Date().toISOString().split("T")[0]!;
  const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  const tasks = await db.select().from(maintenanceTasksTable).orderBy(maintenanceTasksTable.nextDueDate);
  const recentRecords = await db
    .select()
    .from(serviceRecordsTable)
    .orderBy(desc(serviceRecordsTable.createdAt))
    .limit(5);

  const totalAssets = assets.length;
  const verifiedAssets = assets.filter((a) => a.status === "verified").length;
  const unverifiedAssets = assets.filter((a) => a.status === "unverified").length;
  const overdueTaskCount = tasks.filter((t) => t.nextDueDate < today && !t.completedAt).length;
  const dueSoonTaskCount = tasks.filter(
    (t) => t.nextDueDate >= today && t.nextDueDate <= thirtyDaysOut && !t.completedAt
  ).length;
  const upcomingTasks = tasks.filter((t) => t.nextDueDate >= today && !t.completedAt).slice(0, 8);

  // Health score calculation
  const assetScores = assets.map((a) => calcAssetScore(a));
  const { score: homeHealthScore, grade: homeHealthGrade, assetAgeScore, overdueScore } = calcHealthScore(assetScores, overdueTaskCount);
  const criticalAssets = assetScores.filter((s) => s.score < 40);

  const categoryMap: Record<string, { total: number; verified: number }> = {};
  for (const a of assets) {
    if (!categoryMap[a.category]) categoryMap[a.category] = { total: 0, verified: 0 };
    categoryMap[a.category]!.total++;
    if (a.status === "verified") categoryMap[a.category]!.verified++;
  }
  const assetHealthByCategory = Object.entries(categoryMap).map(([category, stats]) => ({
    category,
    ...stats,
  }));

  res.json({
    totalProperties: properties.length,
    totalAssets,
    verifiedAssets,
    unverifiedAssets,
    overdueTaskCount,
    dueSoonTaskCount,
    homeHealthScore,
    homeHealthGrade,
    scoringBreakdown: {
      assetAgeScore,
      overdueScore,
      criticalAssets,
    },
    upcomingTasks,
    recentRecords,
    assetHealthByCategory,
  });
});

router.get("/dashboard/activity", async (req, res) => {
  const recentRecords = await db
    .select({
      id: serviceRecordsTable.id,
      assetId: serviceRecordsTable.assetId,
      description: serviceRecordsTable.description,
      createdAt: serviceRecordsTable.createdAt,
      assetName: assetsTable.name,
      propertyName: propertiesTable.name,
    })
    .from(serviceRecordsTable)
    .innerJoin(assetsTable, eq(serviceRecordsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .orderBy(desc(serviceRecordsTable.createdAt))
    .limit(20);

  const activity = recentRecords.map((r) => ({
    id: r.id,
    type: "service_record" as const,
    title: `Service logged: ${r.assetName}`,
    description: r.description,
    propertyName: r.propertyName,
    assetName: r.assetName,
    createdAt: r.createdAt,
  }));

  res.json(activity);
});

export default router;
