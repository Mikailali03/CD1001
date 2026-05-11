import Stripe from 'stripe';

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY environment variable is not set. ' +
      'Add your Stripe secret key in the Secrets tab.'
    );
  }
  return key;
}

export function getUncachableStripeClient(): Stripe {
  return new Stripe(getSecretKey());
}
