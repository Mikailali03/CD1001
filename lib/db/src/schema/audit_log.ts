import { pgTable, index, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// Append-only record of changes to a home's history. No foreign keys, so entries
// outlive the assets, records and properties they describe.
export const auditLogTable = pgTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Null for system actions (scheduler, migrations).
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull().$type<"asset" | "service_record" | "property" | "ownership_claim" | "marketplace_job">(),
  entityId: text("entity_id").notNull(),
  propertyId: text("property_id"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("audit_log_property_id_idx").on(t.propertyId),
  index("audit_log_entity_idx").on(t.entityType, t.entityId),
]);

export type AuditLogEntry = typeof auditLogTable.$inferSelect;
