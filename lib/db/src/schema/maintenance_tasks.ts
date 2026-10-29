import { pgTable, index, text, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";

export const maintenanceTasksTable = pgTable("maintenance_tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  assetId: text("asset_id").notNull().references(() => assetsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  intervalDays: integer("interval_days").notNull(),
  nextDueDate: text("next_due_date").notNull(),
  completedAt: timestamp("completed_at"),
  isDiy: boolean("is_diy").notNull().default(true),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("maintenance_tasks_asset_id_idx").on(t.assetId),
]);

export const insertMaintenanceTaskSchema = createInsertSchema(maintenanceTasksTable).omit({ id: true, createdAt: true });
export type InsertMaintenanceTask = z.infer<typeof insertMaintenanceTaskSchema>;
export type MaintenanceTask = typeof maintenanceTasksTable.$inferSelect;
