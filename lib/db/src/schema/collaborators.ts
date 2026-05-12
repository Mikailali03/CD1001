import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";

export const collaboratorStatusEnum = pgEnum("collaborator_status", ["pending", "accepted"]);

export const propertyCollaboratorsTable = pgTable("property_collaborators", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  propertyId: text("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  invitedByUserId: text("invited_by_user_id").notNull(),
  invitedEmail: text("invited_email").notNull(),
  acceptedUserId: text("accepted_user_id"),
  status: collaboratorStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PropertyCollaborator = typeof propertyCollaboratorsTable.$inferSelect;
