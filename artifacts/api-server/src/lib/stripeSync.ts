import type Stripe from "stripe";
import { db } from "@workspace/db";
import { subscriptionsTable, type SubscriptionTier } from "@workspace/db";
import { and, eq, isNull, or } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient.js";
import { logger } from "./logger.js";

const PAID_TIERS: SubscriptionTier[] = ["basic", "managed", "concierge"];

// past_due keeps access while Stripe retries the card; anything else that
// isn't active (unpaid, canceled, incomplete_expired, paused…) drops to free.
const ENTITLED_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

function tierFromSubscription(sub: Stripe.Subscription): SubscriptionTier | null {
  const product = sub.items.data[0]?.price.product;
  const tier = product && typeof product === "object" && "metadata" in product ? product.metadata?.tier : undefined;
  return PAID_TIERS.includes(tier as SubscriptionTier) ? (tier as SubscriptionTier) : null;
}

/**
 * Re-read a subscription from Stripe and write its current state to our DB.
 * Always fetching the latest state (rather than trusting the event payload)
 * makes webhook handling idempotent and immune to out-of-order delivery.
 *
 * Rows are matched by userId when known (checkout), otherwise by Stripe
 * customer id (subscription lifecycle events).
 */
export async function syncStripeSubscription(
  subscriptionId: string,
  match: { userId: string } | { customerId: string },
): Promise<SubscriptionTier> {
  const stripe = getUncachableStripeClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const entitled = ENTITLED_STATUSES.has(sub.status);
  const tier = entitled ? tierFromSubscription(sub) : null;
  if (entitled && !tier) {
    logger.error({ subscriptionId }, "Stripe subscription has no recognised tier in product metadata");
  }

  await db
    .update(subscriptionsTable)
    .set({
      tier: tier ?? "essential",
      stripeCustomerId: customerId,
      stripeSubscriptionId: entitled ? sub.id : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        "userId" in match
          ? eq(subscriptionsTable.userId, match.userId)
          : eq(subscriptionsTable.stripeCustomerId, match.customerId),
        // A late "canceled" event for an old subscription must not wipe out a
        // newer active one on the same customer.
        entitled
          ? undefined
          : or(isNull(subscriptionsTable.stripeSubscriptionId), eq(subscriptionsTable.stripeSubscriptionId, sub.id)),
      ),
    );

  logger.info({ subscriptionId, status: sub.status, tier: tier ?? "essential" }, "Synced Stripe subscription");
  return tier ?? "essential";
}
