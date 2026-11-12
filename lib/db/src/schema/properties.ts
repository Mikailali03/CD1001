import { pgTable, index, text, integer, numeric, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertiesTable = pgTable("properties", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  latitude: real("latitude"),
  longitude: real("longitude"),
  photoUrl: text("photo_url"),
  // Null once the owner deletes their account and the home's history is kept as
  // an unclaimed dossier (see releasedAt) for the next owner to claim.
  userId: text("user_id"),
  ownerEmail: text("owner_email"),
  releasedAt: timestamp("released_at"),
  // Set on release, for matching a new owner's address to the unclaimed dossier.
  normalizedAddress: text("normalized_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("properties_user_id_idx").on(t.userId),
  index("properties_normalized_address_idx").on(t.normalizedAddress),
]);

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
