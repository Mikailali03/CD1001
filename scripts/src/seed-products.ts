import { getUncachableStripeClient } from './stripeClient.js';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('Seeding Casa Dossier subscription products...\n');

  // --- Managed Plan ---
  const existingManaged = await stripe.products.search({
    query: "metadata['tier']:'managed' AND active:'true'",
  });

  if (existingManaged.data.length > 0) {
    console.log(`✓ Managed Plan already exists (${existingManaged.data[0].id})`);
  } else {
    const managed = await stripe.products.create({
      name: 'Casa Dossier Managed',
      description: 'Up to 5 properties, professional onboarding, quarterly HVAC filter delivery, 15% off service calls.',
      metadata: { tier: 'managed' },
    });

    const managedPrice = await stripe.prices.create({
      product: managed.id,
      unit_amount: 3500,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log(`✓ Created Managed Plan: ${managed.id}`);
    console.log(`  Price: $35.00/mo → ${managedPrice.id}`);
  }

  // --- Concierge Plan ---
  const existingConcierge = await stripe.products.search({
    query: "metadata['tier']:'concierge' AND active:'true'",
  });

  if (existingConcierge.data.length > 0) {
    console.log(`✓ Concierge Plan already exists (${existingConcierge.data[0].id})`);
  } else {
    const concierge = await stripe.products.create({
      name: 'Casa Dossier Concierge',
      description: 'Unlimited properties, same-day support, 25% off service calls, 4 free service credits/year, dedicated advisor.',
      metadata: { tier: 'concierge' },
    });

    const conciergePrice = await stripe.prices.create({
      product: concierge.id,
      unit_amount: 9900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log(`✓ Created Concierge Plan: ${concierge.id}`);
    console.log(`  Price: $99.00/mo → ${conciergePrice.id}`);
  }

  console.log('\nDone! Webhooks will sync these products to the database automatically.');
}

seedProducts().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
