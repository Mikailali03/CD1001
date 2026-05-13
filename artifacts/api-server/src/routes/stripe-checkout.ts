import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, TIER_PROPERTY_LIMITS } from "@workspace/db";
import { eq } from "drizzle-orm";
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

// Find a Stripe price ID for the given tier by searching products in Stripe directly
async function getPriceIdForTier(tier: "managed" | "concierge"): Promise<string | null> {
  try {
    const stripe = getUncachableStripeClient();
    const products = await stripe.products.search({
      query: `metadata['tier']:'${tier}' AND active:'true'`,
    });
    if (!products.data.length) return null;

    const prices = await stripe.prices.list({
      product: products.data[0].id,
      active: true,
      type: "recurring",
      limit: 1,
    });
    return prices.data[0]?.id ?? null;
  } catch (err) {
    logger.error({ err }, `Failed to get price for tier ${tier}`);
    return null;
  }
}

// GET /api/stripe/plans — public: lists available plans for display
router.get("/stripe/plans", async (_req, res) => {
  try {
    const stripe = getUncachableStripeClient();
    const products = await stripe.products.search({
      query: "active:'true'",
    });

    const plans = await Promise.all(
      products.data
        .filter((p) => p.metadata?.tier)
        .map(async (product) => {
          const prices = await stripe.prices.list({
            product: product.id,
            active: true,
            type: "recurring",
          });
          return {
            productId: product.id,
            name: product.name,
            description: product.description,
            tier: product.metadata.tier,
            prices: prices.data.map((pr) => ({
              id: pr.id,
              unitAmount: pr.unit_amount,
              currency: pr.currency,
              interval: (pr.recurring as any)?.interval,
            })),
          };
        })
    );

    res.json({ plans });
  } catch (err) {
    logger.error({ err }, "Failed to fetch Stripe plans");
    res.json({ plans: [] });
  }
});

// POST /api/stripe/checkout — creates a Stripe Checkout session for a paid tier
router.post("/stripe/checkout", requireAuth(), async (req, res) => {
  const { tier } = req.body as { tier: "managed" | "concierge" };

  if (!tier || !["managed", "concierge"].includes(tier)) {
    return res.status(400).json({ error: "Invalid tier. Must be 'managed' or 'concierge'." });
  }

  const priceId = await getPriceIdForTier(tier);
  if (!priceId) {
    return res.status(404).json({
      error: "No active price found for this tier. Run the seed script first.",
    });
  }

  const sub = await getOrCreateSubscription(req.userId);
  const stripe = getUncachableStripeClient();

  let customerId = sub.stripeCustomerId ?? undefined;

  async function createFreshCustomer() {
    const customer = await stripe.customers.create({
      metadata: { userId: req.userId },
    });
    await db
      .update(subscriptionsTable)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, req.userId));
    return customer.id;
  }

  if (!customerId) {
    customerId = await createFreshCustomer();
  }

  const host = process.env.REPLIT_DOMAINS?.split(",")[0];
  const basePath = process.env.BASE_PATH ?? "";
  const appUrl = host
    ? `https://${host}${basePath}`
    : `http://localhost:${process.env.PORT}${basePath}`;

  const sessionParams = {
    customer: customerId,
    payment_method_types: ["card"] as const,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription" as const,
    success_url: `${appUrl}/dashboard?stripe_success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings`,
    metadata: { userId: req.userId, tier },
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err: any) {
    // Stale customer ID (e.g. from a previous sandbox key) — create a fresh one and retry
    if (err?.code === "resource_missing" && err?.param === "customer") {
      logger.warn({ oldCustomerId: customerId }, "Stale Stripe customer ID detected, creating fresh customer");
      customerId = await createFreshCustomer();
      session = await stripe.checkout.sessions.create({ ...sessionParams, customer: customerId });
    } else {
      throw err;
    }
  }

  res.json({ url: session.url });
});

// POST /api/stripe/sync — called on checkout success to confirm the tier upgrade
router.post("/stripe/sync", requireAuth(), async (req, res) => {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const stripe = getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return res.status(400).json({ error: "Checkout session not completed" });
  }

  const tier = (session.metadata?.tier ?? "essential") as SubscriptionTier;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as any)?.id ?? null;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as any)?.id ?? null;

  await db
    .update(subscriptionsTable)
    .set({
      tier,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.userId, req.userId));

  res.json({ tier, propertyLimit: TIER_PROPERTY_LIMITS[tier] ?? 1 });
});

// POST /api/stripe/portal — opens the Stripe billing portal for an existing subscriber
router.post("/stripe/portal", requireAuth(), async (req, res) => {
  const sub = await getOrCreateSubscription(req.userId);
  if (!sub.stripeCustomerId) {
    return res.status(400).json({ error: "No Stripe customer found. Subscribe first." });
  }

  const stripe = getUncachableStripeClient();
  const host = process.env.REPLIT_DOMAINS?.split(",")[0];
  const basePath = process.env.BASE_PATH ?? "";
  const appUrl = host
    ? `https://${host}${basePath}`
    : `http://localhost:${process.env.PORT}${basePath}`;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/settings`,
  });

  res.json({ url: portalSession.url });
});

export default router;
