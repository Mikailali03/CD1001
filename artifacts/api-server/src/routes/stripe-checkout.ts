import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, TIER_PROPERTY_LIMITS } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getUncachableStripeClient } from "../stripeClient.js";
import { logger } from "../lib/logger.js";

const router = Router();

type SubscriptionTier = "essential" | "managed" | "concierge";

async function getOrCreateSubscription(userId: string) {
  const existing = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(subscriptionsTable).values({ userId, tier: "essential" }).returning();
  return created!;
}

async function getPriceIdForTier(tier: "managed" | "concierge"): Promise<string | null> {
  try {
    const result = await db.execute(
      sql`
        SELECT pr.id as price_id
        FROM stripe.products p
        JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
          AND p.metadata->>'tier' = ${tier}
          AND pr.recurring IS NOT NULL
        ORDER BY pr.unit_amount ASC
        LIMIT 1
      `
    );
    const row = result.rows[0] as { price_id?: string } | undefined;
    return row?.price_id ?? null;
  } catch {
    return null;
  }
}

// GET /api/stripe/plans — returns products+prices for display
router.get("/stripe/plans", async (_req, res) => {
  try {
    const result = await db.execute(
      sql`
        SELECT
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring
        FROM stripe.products p
        JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY pr.unit_amount ASC
      `
    );

    res.json({ plans: result.rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch Stripe plans");
    res.json({ plans: [] });
  }
});

// POST /api/stripe/checkout — creates Stripe Checkout session for a paid tier
router.post("/stripe/checkout", requireAuth(), async (req, res) => {
  const { tier } = req.body as { tier: "managed" | "concierge" };

  if (!tier || !["managed", "concierge"].includes(tier)) {
    return res.status(400).json({ error: "Invalid tier. Must be 'managed' or 'concierge'." });
  }

  const priceId = await getPriceIdForTier(tier);
  if (!priceId) {
    return res.status(404).json({ error: "No active price found for this tier. Run the seed script first." });
  }

  const sub = await getOrCreateSubscription(req.userId);
  const stripe = await getUncachableStripeClient();

  let customerId = sub.stripeCustomerId ?? undefined;

  // Create or retrieve Stripe customer
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { userId: req.userId },
    });
    customerId = customer.id;
    await db
      .update(subscriptionsTable)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, req.userId));
  }

  const host = process.env.REPLIT_DOMAINS?.split(",")[0];
  const basePath = process.env.BASE_PATH ?? "";
  const appUrl = host ? `https://${host}${basePath}` : `http://localhost:${process.env.PORT}${basePath}`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${appUrl}/dashboard?stripe_success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings`,
    metadata: { userId: req.userId, tier },
  });

  res.json({ url: session.url });
});

// POST /api/stripe/sync — called after checkout success to update our subscription tier
router.post("/stripe/sync", requireAuth(), async (req, res) => {
  const { sessionId } = req.body as { sessionId: string };

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const stripe = await getUncachableStripeClient();

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return res.status(400).json({ error: "Checkout session not completed" });
  }

  const tier = (session.metadata?.tier ?? "essential") as SubscriptionTier;
  const stripeSubscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null;
  const stripeCustomerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id ?? null;

  await db
    .update(subscriptionsTable)
    .set({
      tier,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.userId, req.userId));

  res.json({
    tier,
    propertyLimit: TIER_PROPERTY_LIMITS[tier] ?? 1,
  });
});

// POST /api/stripe/portal — billing portal for managing/cancelling subscriptions
router.post("/stripe/portal", requireAuth(), async (req, res) => {
  const sub = await getOrCreateSubscription(req.userId);

  if (!sub.stripeCustomerId) {
    return res.status(400).json({ error: "No Stripe customer found. Subscribe first." });
  }

  const stripe = await getUncachableStripeClient();
  const host = process.env.REPLIT_DOMAINS?.split(",")[0];
  const basePath = process.env.BASE_PATH ?? "";
  const appUrl = host ? `https://${host}${basePath}` : `http://localhost:${process.env.PORT}${basePath}`;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/settings`,
  });

  res.json({ url: portalSession.url });
});

export default router;
