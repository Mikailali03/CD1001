import { Router } from "express";
import { db } from "@workspace/db";
import { guidesTable, insertGuideSchema, type Guide } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ListGuidesQueryParams, GetGuideParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { sendBroadcastPush } from "../lib/pushNotifications.js";

const router = Router();

router.get("/guides", async (req, res) => {
  const query = ListGuidesQueryParams.parse(req.query);
  const conditions = [];
  if (query.category) conditions.push(eq(guidesTable.category, query.category));
  if (query.difficulty) conditions.push(eq(guidesTable.difficulty, query.difficulty as Guide["difficulty"]));

  const guides = await db
    .select()
    .from(guidesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(guidesTable.title);

  const parsed = guides.map((g) => ({
    ...g,
    toolsNeeded: g.toolsNeeded ? JSON.parse(g.toolsNeeded) : [],
    steps: g.steps ? JSON.parse(g.steps) : [],
  }));

  res.json(parsed);
});

router.get("/guides/:guideId", async (req, res) => {
  const { guideId } = GetGuideParams.parse(req.params);
  const [guide] = await db.select().from(guidesTable).where(eq(guidesTable.id, guideId));
  if (!guide) {
    res.status(404).json({ error: "Guide not found" });
    return;
  }
  res.json({
    ...guide,
    toolsNeeded: guide.toolsNeeded ? JSON.parse(guide.toolsNeeded) : [],
    steps: guide.steps ? JSON.parse(guide.steps) : [],
  });
});

// Admin: publish a new guide and notify all users
router.post("/guides", requireAuth(), requireAdmin(), async (req, res) => {
  const data = insertGuideSchema.parse(req.body);

  const [guide] = await db
    .insert(guidesTable)
    .values({
      ...data,
      toolsNeeded: data.toolsNeeded ?? null,
      steps: data.steps ?? null,
    })
    .returning();

  // Fire-and-forget broadcast — don't block the response
  sendBroadcastPush({
    title: "New DIY Guide Published",
    body: `"${guide!.title}" is now available in the DIY Guides section.`,
    data: { screen: "guides", guideId: guide!.id },
  }).catch(() => {/* best-effort */});

  res.status(201).json({
    ...guide,
    toolsNeeded: guide!.toolsNeeded ? JSON.parse(guide!.toolsNeeded) : [],
    steps: guide!.steps ? JSON.parse(guide!.steps) : [],
  });
});

export default router;
