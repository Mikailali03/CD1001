import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { emailTemplatesTable } from "./email_templates";

export const TRIGGER_EVENTS = [
  "technician_accepted_job",
  "job_completed",
  "overdue_maintenance",
  "asset_end_of_life",
  "property_transfer_initiated",
  "collaborator_invited",
  "new_feature_announcement",
  "monthly_update",
  "custom",
] as const;

export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

export const emailTriggersTable = pgTable("email_triggers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  templateId: text("template_id").references(() => emailTemplatesTable.id, {
    onDelete: "set null",
  }),
  triggerEvent: text("trigger_event").notNull().$type<TriggerEvent>(),
  conditions: jsonb("conditions").$type<Record<string, unknown>>(),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailTriggerSchema = createInsertSchema(emailTriggersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailTrigger = z.infer<typeof insertEmailTriggerSchema>;
export type EmailTrigger = typeof emailTriggersTable.$inferSelect;
