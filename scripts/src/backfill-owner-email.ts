import { createClerkClient } from "@clerk/backend";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, isNull, ne } from "drizzle-orm";
import pg from "pg";

const { Pool } = pg;

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Inline the table definition to avoid importing the whole workspace lib
import { pgTable, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";

const propertiesTable = pgTable("properties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  yearBuilt: integer("year_built"),
  sqft: integer("sqft"),
  bedrooms: integer("bedrooms"),
  bathrooms: numeric("bathrooms", { precision: 4, scale: 1 }),
  lotSize: integer("lot_size"),
  photoUrl: text("photo_url"),
  userId: text("user_id").notNull(),
  ownerEmail: text("owner_email"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

async function run() {
  // Find all properties with a real user ID but no email yet
  const rows = await db
    .select({ id: propertiesTable.id, userId: propertiesTable.userId })
    .from(propertiesTable)
    .where(
      eq(propertiesTable.ownerEmail, null as any)
    );

  const toBackfill = rows.filter((r) => r.userId !== "demo-user");

  if (toBackfill.length === 0) {
    console.log("Nothing to backfill — all records already have an email.");
    await pool.end();
    return;
  }

  console.log(`Found ${toBackfill.length} record(s) to backfill...`);

  // Deduplicate by userId so we only hit Clerk once per user
  const userIds = [...new Set(toBackfill.map((r) => r.userId))];
  const emailByUserId = new Map<string, string>();

  for (const userId of userIds) {
    try {
      const user = await clerkClient.users.getUser(userId);
      const email =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;
      if (email) {
        emailByUserId.set(userId, email);
        console.log(`  ${userId} → ${email}`);
      } else {
        console.log(`  ${userId} → (no email found in Clerk)`);
      }
    } catch (err) {
      console.warn(`  ${userId} → FAILED to fetch from Clerk:`, err);
    }
  }

  // Update each property row
  let updated = 0;
  for (const { id, userId } of toBackfill) {
    const email = emailByUserId.get(userId);
    if (!email) continue;
    await db
      .update(propertiesTable)
      .set({ ownerEmail: email })
      .where(eq(propertiesTable.id, id));
    updated++;
  }

  console.log(`\nDone — stamped ${updated} property record(s) with owner email.`);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
