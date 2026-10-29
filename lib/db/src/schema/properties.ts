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
  userId: text("user_id").notNull(),
  ownerEmail: text("owner_email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("properties_user_id_idx").on(t.userId),
]);

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
