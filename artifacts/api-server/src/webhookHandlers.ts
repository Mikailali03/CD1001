import { getUncachableStripeClient } from './stripeClient.js';
import { logger } from './lib/logger.js';
import { syncStripeSubscription } from './lib/stripeSync.js';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Throw (→ 400) rather than silently acknowledging: Stripe keeps
      // retrying, so events aren't lost once the secret is configured.
      throw new Error('STRIPE_WEBHOOK_SECRET not set — cannot verify webhook');
    }

    if (!Buffer.isBuffer(payload)) {
      throw new Error('Payload must be a Buffer — ensure webhook route is before express.json()');
    }

    const stripe = getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription : session.subscription?.id;
        if (!userId || !subscriptionId) break;

        await syncStripeSubscription(subscriptionId, { userId });
        break;
      }

      // Plan changes from the billing portal, failed renewals (past_due →
      // unpaid), cancellations and reactivations all arrive as one of these.
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        const sub = event.data.object;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        await syncStripeSubscription(sub.id, { customerId });
        break;
      }

      default:
        break;
    }
  }
}
