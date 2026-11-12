import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("homeowner").$type<"homeowner" | "technician" | "admin">(),
  technicianNumber: text("technician_number"),
  phone: text("phone"),
  // Maintenance notification preferences. Reminder emails carry a one-click
  // unsubscribe link keyed by unsubscribeToken, so no sign-in is needed.
  emailReminders: boolean("email_reminders").notNull().default(true),
  pushReminders: boolean("push_reminders").notNull().default(true),
  weeklySummary: boolean("weekly_summary").notNull().default(true),
  unsubscribeToken: text("unsubscribe_token").notNull().unique().default(sql`gen_random_uuid()::text`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
