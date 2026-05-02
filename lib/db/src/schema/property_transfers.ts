import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const propertyTransfersTable = pgTable("property_transfers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: text("property_id").notNull(),
  fromUserId: text("from_user_id").notNull(),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  toUserId: text("to_user_id"),
  status: text("status").notNull().default("pending"),
  token: text("token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export type PropertyTransfer = typeof propertyTransfersTable.$inferSelect;
