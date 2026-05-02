import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

export const assetCategoryEnum = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"] as const;
export const assetStatusEnum = ["verified", "unverified", "needs_attention"] as const;

export const assetsTable = pgTable("assets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: text("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().$type<typeof assetCategoryEnum[number]>(),
  brand: text("brand"),
  model: text("model"),
  serialNumber: text("serial_number"),
  installDate: text("install_date"),
  warrantyExpiry: text("warranty_expiry"),
  status: text("status").notNull().default("unverified").$type<typeof assetStatusEnum[number]>(),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
