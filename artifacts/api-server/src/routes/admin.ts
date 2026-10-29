import { Router } from "express";
import { db, userProfilesTable, emailTemplatesTable, emailTriggersTable, TRIGGER_EVENTS } from "@workspace/db";
import { eq, ilike, or, count, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

const adminAuth = [requireAuth(), requireAdmin()];

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/admin/stats", ...adminAuth, async (req, res) => {
  const [usersResult, propertiesResult, techniciansResult, recordsResult] = await Promise.all([
    db.select({ count: count() }).from(userProfilesTable),
    db.execute(sql`SELECT COUNT(*) as count FROM properties`),
    db
      .select({ count: count() })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.role, "technician")),
    db.execute(sql`SELECT COUNT(*) as count FROM service_records`),
  ]);

  res.json({
    totalUsers: Number(usersResult[0]?.count ?? 0),
    totalProperties: Number((propertiesResult.rows[0] as { count: string })?.count ?? 0),
    totalTechnicians: Number(techniciansResult[0]?.count ?? 0),
    totalServiceRecords: Number((recordsResult.rows[0] as { count: string })?.count ?? 0),
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

const ListUsersQuery = z.object({
  search: z.string().optional(),
  role: z.enum(["homeowner", "technician", "admin"]).optional(),
});

router.get("/admin/users", ...adminAuth, async (req, res) => {
  const { search, role } = ListUsersQuery.parse(req.query);

  const conditions = [];
  if (role) conditions.push(eq(userProfilesTable.role, role));
  if (search) {
    conditions.push(
      or(
        ilike(userProfilesTable.firstName, `%${search}%`),
        ilike(userProfilesTable.lastName, `%${search}%`),
        ilike(userProfilesTable.email, `%${search}%`),
      )!,
    );
  }

  const users = await db
    .select()
    .from(userProfilesTable)
    .where(conditions.length ? (conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`) : undefined)
    .orderBy(userProfilesTable.createdAt);

  res.json(users);
});

const UpdateUserBody = z.object({
  role: z.enum(["homeowner", "technician", "admin"]),
});
const UpdateUserParams = z.object({ userId: z.string() });

router.patch("/admin/users/:userId", ...adminAuth, async (req, res) => {
  const { userId } = UpdateUserParams.parse(req.params);
  const { role } = UpdateUserBody.parse(req.body);

  const [existing] = await db
    .select({ technicianNumber: userProfilesTable.technicianNumber })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (!existing) { res.status(404).json({ error: "User not found" }); return; }

  const technicianNumber =
    existing.technicianNumber ??
    (role === "technician" ? `TECH-${Math.floor(100000 + Math.random() * 900000)}` : null);

  const [updated] = await db
    .update(userProfilesTable)
    .set({ role, technicianNumber, updatedAt: new Date() })
    .where(eq(userProfilesTable.userId, userId))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(updated);
});

// ─── Email Templates ──────────────────────────────────────────────────────────

const TemplateBody = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["marketing", "notification", "transactional"]),
});

router.get("/admin/email-templates", ...adminAuth, async (_req, res) => {
  const templates = await db
    .select()
    .from(emailTemplatesTable)
    .orderBy(emailTemplatesTable.createdAt);
  res.json(templates);
});

router.post("/admin/email-templates", ...adminAuth, async (req, res) => {
  const body = TemplateBody.parse(req.body);
  const [template] = await db
    .insert(emailTemplatesTable)
    .values({ ...body, updatedAt: new Date() })
    .returning();
  res.status(201).json(template);
});

const TemplateParams = z.object({ templateId: z.string() });

router.put("/admin/email-templates/:templateId", ...adminAuth, async (req, res) => {
  const { templateId } = TemplateParams.parse(req.params);
  const body = TemplateBody.parse(req.body);

  const [template] = await db
    .update(emailTemplatesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(emailTemplatesTable.id, templateId))
    .returning();

  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(template);
});

router.delete("/admin/email-templates/:templateId", ...adminAuth, async (req, res) => {
  const { templateId } = TemplateParams.parse(req.params);
  await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, templateId));
  res.status(204).send();
});

// ─── Email Triggers ───────────────────────────────────────────────────────────

const TriggerBody = z.object({
  name: z.string().min(1),
  templateId: z.string().nullable().optional(),
  triggerEvent: z.enum(TRIGGER_EVENTS),
  conditions: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

router.get("/admin/email-triggers", ...adminAuth, async (_req, res) => {
  const triggers = await db
    .select()
    .from(emailTriggersTable)
    .orderBy(emailTriggersTable.createdAt);
  res.json(triggers);
});

router.post("/admin/email-triggers", ...adminAuth, async (req, res) => {
  const body = TriggerBody.parse(req.body);
  const [trigger] = await db
    .insert(emailTriggersTable)
    .values({ ...body, updatedAt: new Date() })
    .returning();
  res.status(201).json(trigger);
});

const TriggerParams = z.object({ triggerId: z.string() });

router.put("/admin/email-triggers/:triggerId", ...adminAuth, async (req, res) => {
  const { triggerId } = TriggerParams.parse(req.params);
  const body = TriggerBody.parse(req.body);

  const [trigger] = await db
    .update(emailTriggersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(emailTriggersTable.id, triggerId))
    .returning();

  if (!trigger) { res.status(404).json({ error: "Trigger not found" }); return; }
  res.json(trigger);
});

router.delete("/admin/email-triggers/:triggerId", ...adminAuth, async (req, res) => {
  const { triggerId } = TriggerParams.parse(req.params);
  await db.delete(emailTriggersTable).where(eq(emailTriggersTable.id, triggerId));
  res.status(204).send();
});

router.patch("/admin/email-triggers/:triggerId/toggle", ...adminAuth, async (req, res) => {
  const { triggerId } = TriggerParams.parse(req.params);

  const [existing] = await db
    .select()
    .from(emailTriggersTable)
    .where(eq(emailTriggersTable.id, triggerId));

  if (!existing) { res.status(404).json({ error: "Trigger not found" }); return; }

  const [trigger] = await db
    .update(emailTriggersTable)
    .set({ isActive: !existing.isActive, updatedAt: new Date() })
    .where(eq(emailTriggersTable.id, triggerId))
    .returning();

  res.json(trigger);
});

export default router;
