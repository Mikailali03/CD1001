import { getUncachableStripeClient } from './stripeClient.js';
import { db } from '@workspace/db';
import { subscriptionsTable, TIER_PROPERTY_LIMITS } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { logger } from './lib/logger.js';

type SubscriptionTier = 'essential' | 'managed' | 'concierge';

const PRICE_TO_TIER: Record<string, SubscriptionTier> = {};

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      return;
    }

    if (!Buffer.isBuffer(payload)) {
      throw new Error('Payload must be a Buffer — ensure webhook route is before express.json()');
    }

    const stripe = getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    logger.info({ type: event.type }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const tier = (session.metadata?.tier ?? 'essential') as SubscriptionTier;
        if (!userId) break;

        const stripeSubscriptionId = typeof session.subscription === 'string'
          ? session.subscription : session.subscription?.id ?? null;
        const stripeCustomerId = typeof session.customer === 'string'
          ? session.customer : session.customer?.id ?? null;

        await db.update(subscriptionsTable)
          .set({ tier, stripeCustomerId: stripeCustomerId ?? undefined, stripeSubscriptionId: stripeSubscriptionId ?? undefined, updatedAt: new Date() })
          .where(eq(subscriptionsTable.userId, userId));

        logger.info({ userId, tier }, 'Subscription updated after checkout');
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        await db.update(subscriptionsTable)
          .set({ tier: 'essential', stripeSubscriptionId: null, updatedAt: new Date() })
          .where(eq(subscriptionsTable.stripeCustomerId, customerId));

        logger.info({ customerId }, 'Subscription cancelled — downgraded to essential');
        break;
      }

      default:
        break;
    }
  }
}
