import { pgTable, index, text, timestamp } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";

export const OWNERSHIP_DOCUMENT_TYPES = ["closing_document", "photo_id"] as const;
export const OWNERSHIP_CLAIM_STATUSES = ["pending", "approved", "rejected"] as const;

// A new owner's request to inherit an unclaimed dossier's history. The uploaded
// document is readable only by admins and is deleted once a decision is made;
// only its type and the decision are kept.
export const ownershipClaimsTable = pgTable("ownership_claims", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  // The unclaimed dossier being claimed. Null after approval, when the dossier is
  // merged into the target and deleted; the claim row stays as the record.
  dossierPropertyId: text("dossier_property_id").references(() => propertiesTable.id, { onDelete: "set null" }),
  // The claimant's own property that inherits the history on approval.
  targetPropertyId: text("target_property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  claimantUserId: text("claimant_user_id").notNull(),
  documentType: text("document_type").notNull().$type<typeof OWNERSHIP_DOCUMENT_TYPES[number]>(),
  documentPath: text("document_path"),
  status: text("status").notNull().default("pending").$type<typeof OWNERSHIP_CLAIM_STATUSES[number]>(),
  rejectionReason: text("rejection_reason"),
  reviewedByUserId: text("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ownership_claims_status_idx").on(t.status),
  index("ownership_claims_dossier_idx").on(t.dossierPropertyId),
  index("ownership_claims_document_path_idx").on(t.documentPath),
]);

export type OwnershipClaim = typeof ownershipClaimsTable.$inferSelect;
