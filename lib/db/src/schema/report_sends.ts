import { pgTable, index, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";

// Each time a property report is emailed: shown to the owner as report history
// and used for the daily sending limit.
export const reportSendsTable = pgTable("report_sends", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: text("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  senderUserId: text("sender_user_id").notNull(),
  recipients: jsonb("recipients").notNull().$type<string[]>(),
  includeCosts: boolean("include_costs").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("report_sends_property_id_idx").on(t.propertyId),
  index("report_sends_sender_idx").on(t.senderUserId, t.createdAt),
]);

export type ReportSend = typeof reportSendsTable.$inferSelect;
