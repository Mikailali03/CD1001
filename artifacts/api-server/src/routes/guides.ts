import { Router } from "express";
import { db } from "@workspace/db";
import { guidesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ListGuidesQueryParams, GetGuideParams } from "@workspace/api-zod";

const router = Router();

router.get("/guides", async (req, res) => {
  const query = ListGuidesQueryParams.parse(req.query);
  const conditions = [];
  if (query.category) conditions.push(eq(guidesTable.category, query.category));
  if (query.difficulty) conditions.push(eq(guidesTable.difficulty, query.difficulty));

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
  if (!guide) return res.status(404).json({ error: "Guide not found" });
  res.json({
    ...guide,
    toolsNeeded: guide.toolsNeeded ? JSON.parse(guide.toolsNeeded) : [],
    steps: guide.steps ? JSON.parse(guide.steps) : [],
  });
});

export default router;
