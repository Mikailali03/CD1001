import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, TIER_PROPERTY_LIMITS, UpgradeTierBody } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

async function getOrCreateSubscription(userId: string) {
  const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(subscriptionsTable).values({ userId, tier: "essential" }).returning();
  return created!;
}

router.get("/subscription", requireAuth(), async (req, res) => {
  const sub = await getOrCreateSubscription(req.userId);
  res.json({
    tier: sub.tier,
    propertyLimit: TIER_PROPERTY_LIMITS[sub.tier] ?? 1,
    stripeCustomerId: sub.stripeCustomerId ?? null,
    stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
    aiScansUsed: sub.aiScansUsed ?? 0,
  });
});

router.post("/subscription/upgrade", requireAuth(), async (req, res) => {
  const { tier } = UpgradeTierBody.parse(req.body);
  const sub = await getOrCreateSubscription(req.userId);
  const [updated] = await db
    .update(subscriptionsTable)
    .set({ tier, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, req.userId))
    .returning();
  if (!updated) return res.status(500).json({ error: "Failed to update subscription" });
  res.json({
    tier: updated.tier,
    propertyLimit: TIER_PROPERTY_LIMITS[updated.tier] ?? 1,
  });
});

export default router;
