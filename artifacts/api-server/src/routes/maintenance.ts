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

const CompleteTaskParams = z.object({ taskId: z.string() });
const CompleteTaskBody = z.object({
  notes: z.string().optional(),
  isDiy: z.boolean().optional(),
  cost: z.number().optional(),
});

const router = Router();

// ── Property-level inbox: overdue + due in next 30 days ──────────────────────
const InboxParams = z.object({ propertyId: z.string() });

router.get("/properties/:propertyId/inbox", async (req, res) => {
  const { propertyId } = InboxParams.parse(req.params);

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 30);

  const todayStr   = today.toISOString().split("T")[0]!;
  const cutoffStr  = cutoff.toISOString().split("T")[0]!;

  const rows = await db
    .select({
      id:           maintenanceTasksTable.id,
      assetId:      maintenanceTasksTable.assetId,
      title:        maintenanceTasksTable.title,
      description:  maintenanceTasksTable.description,
      intervalDays: maintenanceTasksTable.intervalDays,
      nextDueDate:  maintenanceTasksTable.nextDueDate,
      isDiy:        maintenanceTasksTable.isDiy,
      estimatedCost: maintenanceTasksTable.estimatedCost,
      assetName:    assetsTable.name,
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

router.get("/assets/:assetId/maintenance", async (req, res) => {
  const { assetId } = ListMaintenanceTasksParams.parse(req.params);
  const tasks = await db
    .select()
    .from(maintenanceTasksTable)
    .where(eq(maintenanceTasksTable.assetId, assetId))
    .orderBy(maintenanceTasksTable.nextDueDate);
  res.json(tasks);
});

router.post("/assets/:assetId/maintenance", async (req, res) => {
  const { assetId } = CreateMaintenanceTaskParams.parse(req.params);
  const body = CreateMaintenanceTaskBody.parse(req.body);
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

router.patch("/maintenance/:taskId", async (req, res) => {
  const { taskId } = UpdateMaintenanceTaskParams.parse(req.params);
  const body = UpdateMaintenanceTaskBody.parse(req.body);
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

router.post("/maintenance/:taskId/complete", async (req, res) => {
  const { taskId } = CompleteTaskParams.parse(req.params);
  const body = CompleteTaskBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(maintenanceTasksTable)
    .where(eq(maintenanceTasksTable.id, taskId));

  if (!existing) return res.status(404).json({ error: "Task not found" });

  // Mark the current task complete
  const [completedTask] = await db
    .update(maintenanceTasksTable)
    .set({ completedAt: new Date() })
    .where(eq(maintenanceTasksTable.id, taskId))
    .returning();

  // Schedule the next recurrence based on today + intervalDays
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

  // Optionally write a service record
  let serviceRecord = null;
  if (body.notes) {
    const today = new Date().toISOString().split("T")[0]!;
    const [sr] = await db
      .insert(serviceRecordsTable)
      .values({
        assetId: existing.assetId,
        date: today,
        description: body.notes,
        technicianName: body.isDiy ? "Homeowner (DIY)" : undefined,
        cost: body.cost != null ? String(body.cost) : undefined,
      })
      .returning();
    serviceRecord = sr;
  }

  res.json({ completedTask, nextTask, serviceRecord });
});

export default router;
