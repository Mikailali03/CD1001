import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, TIER_PROPERTY_LIMITS } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOrCreateSubscription } from "../lib/subscription.js";

const router = Router();

router.get("/subscription", requireAuth(), async (req, res) => {
  const sub = await getOrCreateSubscription(req.userId);
  res.json({
    tier: sub.tier,
    propertyLimit: TIER_PROPERTY_LIMITS[sub.tier] ?? 1,
    stripeCustomerId: sub.stripeCustomerId ?? null,
    stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
    aiScansUsed: sub.aiScansUsed ?? 0,
    aiPlansUsed: sub.aiPlansUsed ?? 0,
  });
});

// Paid tiers are only ever granted by Stripe (webhook or /stripe/sync). This
// route can only move a user back to the free tier, and only when there is no
// live Stripe subscription — otherwise they'd keep being billed, so they must
// cancel through the billing portal and let the webhook downgrade them.
router.post("/subscription/downgrade", requireAuth(), async (req, res) => {
  const sub = await getOrCreateSubscription(req.userId);
  if (sub.stripeSubscriptionId) {
    res.status(409).json({ error: "active_stripe_subscription" });
    return;
  }
  const [updated] = await db
    .update(subscriptionsTable)
    .set({ tier: "essential", updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, req.userId))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Failed to update subscription" });
    return;
  }
  res.json({
    tier: updated.tier,
    propertyLimit: TIER_PROPERTY_LIMITS[updated.tier] ?? 1,
  });
});

export default router;
