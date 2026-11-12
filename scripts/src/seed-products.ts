import { getUncachableStripeClient } from './stripeClient.js';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('Seeding Casa Dossier subscription products...\n');

  // --- Basic Plan ---
  const existingBasic = await stripe.products.search({
    query: "metadata['tier']:'basic' AND active:'true'",
  });

  if (existingBasic.data.length > 0) {
    console.log(`✓ Basic Plan already exists (${existingBasic.data[0].id})`);
  } else {
    const basic = await stripe.products.create({
      name: 'Casa Dossier Basic',
      description: 'Unlimited AI asset scans and maintenance plans, Investment Ledger, Capital Outlook, Digital Locker, collaborators.',
      metadata: { tier: 'basic' },
    });

    const basicPrice = await stripe.prices.create({
      product: basic.id,
      unit_amount: 999,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log(`✓ Created Basic Plan: ${basic.id}`);
    console.log(`  Price: $9.99/mo → ${basicPrice.id}`);
  }

  // --- Managed Plan ---
  const existingManaged = await stripe.products.search({
    query: "metadata['tier']:'managed' AND active:'true'",
  });

  if (existingManaged.data.length > 0) {
    console.log(`✓ Managed Plan already exists (${existingManaged.data[0].id})`);
  } else {
    const managed = await stripe.products.create({
      name: 'Casa Dossier Managed',
      description: 'Everything in Basic, for up to 5 properties.',
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
      description: 'Everything in Basic, for unlimited properties.',
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
