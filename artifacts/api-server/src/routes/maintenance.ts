import { Router } from "express";
import { db } from "@workspace/db";
import { maintenanceTasksTable, serviceRecordsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
