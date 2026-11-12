import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

// One row per notification sent, e.g. key "task:<id>:due_soon:<userId>" on the
// "email" channel. Inserting the row claims the send, so a reminder goes out
// once per recipient and channel no matter how often the scheduler runs.
export const notificationLogTable = pgTable("notification_log", {
  key: text("key").notNull(),
  channel: text("channel").notNull().$type<"email" | "push">(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.key, t.channel] })]);
