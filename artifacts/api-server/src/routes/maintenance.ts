import { Router } from "express";
import { db } from "@workspace/db";
import { maintenanceTasksTable, serviceRecordsTable, assetsTable } from "@workspace/db";
import { eq, and, lte, gte, isNull, inArray } from "drizzle-orm";
import { propertiesTable } from "@workspace/db";
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
import { toDateOnly } from "../lib/dates.js";

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
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

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
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

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
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const [task] = await db
    .insert(maintenanceTasksTable)
    .values({
      ...body,
      assetId,
      nextDueDate: toDateOnly(body.nextDueDate),
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
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const asset = await getAccessibleAsset(existing.assetId, req.userId);
  if (!asset) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // completedAt is deliberately dropped: completing goes through
  // POST /maintenance/:id/complete so the next occurrence and service record
  // get created.
  const { completedAt: _completedAt, nextDueDate, ...rest } = body;
  const [task] = await db
    .update(maintenanceTasksTable)
    .set({
      ...rest,
      nextDueDate: nextDueDate ? toDateOnly(nextDueDate) : undefined,
      estimatedCost: body.estimatedCost != null ? String(body.estimatedCost) : undefined,
    })
    .where(eq(maintenanceTasksTable.id, taskId))
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

router.delete("/maintenance/:taskId", requireAuth(), async (req, res) => {
  const { taskId } = z.object({ taskId: z.string() }).parse(req.params);

  const [existing] = await db
    .select()
    .from(maintenanceTasksTable)
    .where(eq(maintenanceTasksTable.id, taskId));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const asset = await getAccessibleAsset(existing.assetId, req.userId);
  if (!asset) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(maintenanceTasksTable).where(eq(maintenanceTasksTable.id, taskId));
  res.status(204).send();
});

router.post("/maintenance/:taskId/complete", requireAuth(), async (req, res) => {
  const { taskId } = CompleteTaskParams.parse(req.params);
  const body = CompleteTaskBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(maintenanceTasksTable)
    .where(eq(maintenanceTasksTable.id, taskId));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const asset = await getAccessibleAsset(existing.assetId, req.userId);
  if (!asset) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const originalDueDate = new Date(existing.nextDueDate);
  const baseDate = originalDueDate > new Date() ? originalDueDate : new Date();
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + existing.intervalDays);
  const nextDueDate = nextDate.toISOString().split("T")[0]!;

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

  // One transaction, and the completion is conditional on the task still being
  // open — a double-tap or retried request can't create a second next task
  // and a duplicate service record (which would double-count ledger costs).
  const result = await db.transaction(async (tx) => {
    const [completedTask] = await tx
      .update(maintenanceTasksTable)
      .set({ completedAt: new Date() })
      .where(and(eq(maintenanceTasksTable.id, taskId), isNull(maintenanceTasksTable.completedAt)))
      .returning();
    if (!completedTask) return null;

    const [nextTask] = await tx
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

    const [serviceRecord] = await tx
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

    return { completedTask, nextTask, serviceRecord };
  });

  if (!result) {
    res.status(409).json({ error: "This task has already been completed." });
    return;
  }

  res.json(result);
});

// ── User: upcoming tasks across all properties (for local push scheduling) ──
router.get("/maintenance/upcoming", requireAuth(), async (req, res) => {
  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const today = new Date().toISOString().split("T")[0]!;
  const sevenDaysLater = sevenDaysOut.toISOString().split("T")[0]!;

  const userProperties = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(eq(propertiesTable.userId, req.userId));

  if (!userProperties.length) {
    res.json({ tasks: [] });
    return;
  }

  const propertyIds = userProperties.map((p) => p.id);

  const tasks = await db
    .select({
      id: maintenanceTasksTable.id,
      title: maintenanceTasksTable.title,
      nextDueDate: maintenanceTasksTable.nextDueDate,
      assetId: assetsTable.id,
      assetName: assetsTable.name,
    })
    .from(maintenanceTasksTable)
    .innerJoin(assetsTable, eq(maintenanceTasksTable.assetId, assetsTable.id))
    .where(
      and(
        inArray(assetsTable.propertyId, propertyIds),
        gte(maintenanceTasksTable.nextDueDate, today),
        lte(maintenanceTasksTable.nextDueDate, sevenDaysLater),
        isNull(maintenanceTasksTable.completedAt),
      )
    )
    .orderBy(maintenanceTasksTable.nextDueDate);

  res.json({ tasks });
});

export default router;
