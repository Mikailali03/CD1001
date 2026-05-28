import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";

export const marketplaceJobsTable = pgTable("marketplace_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  assetId: text("asset_id").notNull().references(() => assetsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  urgency: text("urgency").notNull().default("medium").$type<"low" | "medium" | "high" | "emergency">(),
  status: text("status").notNull().default("open").$type<"open" | "claimed" | "en_route" | "arrived" | "completed">(),
  contactPhone: text("contact_phone"),
  technicianId: text("technician_id"),
  technicianNumber: text("technician_number"),
  technicianName: text("technician_name"),
  scheduledAt: timestamp("scheduled_at"),
  acceptedAt: timestamp("accepted_at"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMarketplaceJobSchema = createInsertSchema(marketplaceJobsTable).omit({ id: true, createdAt: true });
export type InsertMarketplaceJob = z.infer<typeof insertMarketplaceJobSchema>;
export type MarketplaceJob = typeof marketplaceJobsTable.$inferSelect;
