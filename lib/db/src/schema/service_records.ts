import { pgTable, index, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";

export const serviceRecordsTable = pgTable("service_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  assetId: text("asset_id").notNull().references(() => assetsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  technicianName: text("technician_name"),
  technicianNumber: text("technician_number"),
  companyName: text("company_name"),
  description: text("description").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  nextServiceDate: text("next_service_date"),
  receiptUrl: text("receipt_url"),
  verified: boolean("verified").notNull().default(false),
  casaServiceTechId: text("casa_service_tech_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("service_records_asset_id_idx").on(t.assetId),
]);

export const insertServiceRecordSchema = createInsertSchema(serviceRecordsTable).omit({ id: true, createdAt: true });
export type InsertServiceRecord = z.infer<typeof insertServiceRecordSchema>;
export type ServiceRecord = typeof serviceRecordsTable.$inferSelect;
