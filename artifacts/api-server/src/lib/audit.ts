import { db, auditLogTable } from "@workspace/db";
import { logger } from "./logger.js";

type AuditEntry = {
  actorUserId: string | null;
  action: string;
  entityType: "asset" | "service_record" | "property" | "ownership_claim" | "marketplace_job";
  entityId: string;
  propertyId?: string | null;
  details?: Record<string, unknown>;
};

// Pass a transaction to keep the entry atomic with the change it describes.
type Executor = Pick<typeof db, "insert">;

export async function recordAudit(entry: AuditEntry, executor: Executor = db): Promise<void> {
  await executor.insert(auditLogTable).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    propertyId: entry.propertyId ?? null,
    details: entry.details ?? null,
  });
}

// For call sites where a failed audit write shouldn't fail the user's request.
export function recordAuditInBackground(entry: AuditEntry): void {
  recordAudit(entry).catch((err) => logger.error({ err, entry }, "Audit log write failed"));
}
