import { Router } from "express";
import { db } from "@workspace/db";
import { maintenanceTasksTable, serviceRecordsTable, assetsTable } from "@workspace/db";
import { eq, and, lte, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  ListMaintenanceTasksParams,
  CreateMaintenanceTaskParams,
  CreateMaintenanceTaskBody,
  UpdateMaintenanceTaskParams,
  UpdateMaintenanceTaskBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty, getAccessibleAsset } from "../lib/access.js";

const CompleteTaskParams = z.object({ taskId: z.string() });
const CompleteTaskBody = z.object({
  notes: z.string().optional(),
  isDiy: z.boolean().optional(),
  cost: z.number().optional(),
  technicianName: z.string().optional(),
  companyName: z.string().optional(),
  receiptUrl: z.string().optional(),
  completedDate: z.string().optional(),
});

const router = Router();

const InboxParams = z.object({ propertyId: z.string() });

router.get("/properties/:propertyId/inbox", requireAuth(), async (req, res) => {
  const { propertyId } = InboxParams.parse(req.params);

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 30);

  const todayStr  = today.toISOString().split("T")[0]!;
  const cutoffStr = cutoff.toISOString().split("T")[0]!;

  const rows = await db
    .select({
      id:            maintenanceTasksTable.id,
      assetId:       maintenanceTasksTable.assetId,
      title:         maintenanceTasksTable.title,
      description:   maintenanceTasksTable.description,
      intervalDays:  maintenanceTasksTable.intervalDays,
      nextDueDate:   maintenanceTasksTable.nextDueDate,
      isDiy:         maintenanceTasksTable.isDiy,
      estimatedCost: maintenanceTasksTable.estimatedCost,
      assetName:     assetsTable.name,
      assetCategory: assetsTable.category,
    })
    .from(maintenanceTasksTable)
    .innerJoin(assetsTable, eq(maintenanceTasksTable.assetId, assetsTable.id))
    .where(
      and(
        eq(assetsTable.propertyId, propertyId),
        isNull(maintenanceTasksTable.completedAt),
        lte(maintenanceTasksTable.nextDueDate, cutoffStr)
      )
    )
    .orderBy(maintenanceTasksTable.nextDueDate);

  const overdue  = rows.filter((r) => r.nextDueDate < todayStr);
  const upcoming = rows.filter((r) => r.nextDueDate >= todayStr);

  res.json({ overdue, upcoming, totalCount: rows.length });
});

router.get("/assets/:assetId/maintenance", requireAuth(), async (req, res) => {
  const { assetId } = ListMaintenanceTasksParams.parse(req.params);

  const asset = await getAccessibleAsset(assetId, req.userId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const tasks = await db
    .select()
    .from(maintenanceTasksTable)
    .where(eq(maintenanceTasksTable.assetId, assetId))
    .orderBy(maintenanceTasksTable.nextDueDate);
  res.json(tasks);
});

router.post("/assets/:assetId/maintenance", requireAuth(), async (req, res) => {
  const { assetId } = CreateMaintenanceTaskParams.parse(req.params);
  const body = CreateMaintenanceTaskBody.parse(req.body);

  const asset = await getAccessibleAsset(assetId, req.userId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const [task] = await db
    .insert(maintenanceTasksTable)
    .values({
      ...body,
      assetId,
      estimatedCost: body.estimatedCost != null ? String(body.estimatedCost) : null,
    })
    .returning();
  res.status(201).json(task);
});

router.patch("/maintenance/:taskId", requireAuth(), async (req, res) => {
  const { taskId } = UpdateMaintenanceTaskParams.parse(req.params);
  const body = UpdateMaintenanceTaskBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(maintenanceTasksTable)
    .where(eq(maintenanceTasksTable.id, taskId));
  if (!existing) return res.status(404).json({ error: "Task not found" });

  const asset = await getAccessibleAsset(existing.assetId, req.userId);
  if (!asset) return res.status(403).json({ error: "Forbidden" });

  const [task] = await db
    .update(maintenanceTasksTable)
    .set({
      ...body,
      estimatedCost: body.estimatedCost != null ? String(body.estimatedCost) : undefined,
    })
    .where(eq(maintenanceTasksTable.id, taskId))
    .returning();
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

router.post("/maintenance/:taskId/complete", requireAuth(), async (req, res) => {
  const { taskId } = CompleteTaskParams.parse(req.params);
  const body = CompleteTaskBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(maintenanceTasksTable)
    .where(eq(maintenanceTasksTable.id, taskId));
  if (!existing) return res.status(404).json({ error: "Task not found" });

  const asset = await getAccessibleAsset(existing.assetId, req.userId);
  if (!asset) return res.status(403).json({ error: "Forbidden" });

  const [completedTask] = await db
    .update(maintenanceTasksTable)
    .set({ completedAt: new Date() })
    .where(eq(maintenanceTasksTable.id, taskId))
    .returning();

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + existing.intervalDays);
  const nextDueDate = nextDate.toISOString().split("T")[0]!;

  const [nextTask] = await db
    .insert(maintenanceTasksTable)
    .values({
      assetId: existing.assetId,
      title: existing.title,
      description: existing.description,
      intervalDays: existing.intervalDays,
      nextDueDate,
      isDiy: existing.isDiy,
      estimatedCost: existing.estimatedCost,
    })
    .returning();

  const today = body.completedDate ?? new Date().toISOString().split("T")[0]!;
  const effectiveCost =
    body.cost != null
      ? body.cost
      : existing.estimatedCost != null
      ? parseFloat(String(existing.estimatedCost))
      : undefined;
  const techName =
    body.technicianName?.trim() ||
    (body.isDiy !== false ? "Homeowner (DIY)" : undefined);

  const [serviceRecord] = await db
    .insert(serviceRecordsTable)
    .values({
      assetId: existing.assetId,
      date: today,
      description: body.notes?.trim() || `Completed: ${existing.title}`,
      technicianName: techName,
      companyName: body.companyName?.trim() || undefined,
      cost: effectiveCost != null ? String(effectiveCost) : undefined,
      receiptUrl: body.receiptUrl || undefined,
    })
    .returning();

  res.json({ completedTask, nextTask, serviceRecord });
});

export default router;
