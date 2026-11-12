import { pgTable, index, uniqueIndex, text, timestamp } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";

// Homeowners outside the CasaService area who asked to hear when we reach them.
// One entry per user and property; the city/state/zip are copied in so the list
// still says where demand is if the property is later removed.
export const serviceWaitlistTable = pgTable("service_waitlist", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  propertyId: text("property_id").references(() => propertiesTable.id, { onDelete: "set null" }),
  email: text("email"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("service_waitlist_user_property_idx").on(t.userId, t.propertyId),
  index("service_waitlist_state_idx").on(t.state),
]);

export type ServiceWaitlistEntry = typeof serviceWaitlistTable.$inferSelect;
