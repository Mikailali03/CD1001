import { Router } from "express";
import { db } from "@workspace/db";
import { maintenanceTasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListMaintenanceTasksParams,
  CreateMaintenanceTaskParams,
  CreateMaintenanceTaskBody,
  UpdateMaintenanceTaskParams,
  UpdateMaintenanceTaskBody,
} from "@workspace/api-zod";

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

export default router;
