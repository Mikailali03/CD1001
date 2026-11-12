// Unclaimed dossiers: when an owner deletes their account, homes with service
// history are kept (not deleted) with personal details stripped, so the next
// owner can inherit the history after proving ownership.
import { db } from "@workspace/db";
import {
  assetsTable,
  serviceRecordsTable,
  propertiesTable,
  propertyCollaboratorsTable,
  marketplaceJobsTable,
} from "@workspace/db";
import { and, count, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { normalizeAddress } from "./addresses.js";
import { recordAudit } from "./audit.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** IDs of the given properties that have at least one service record. */
export async function propertiesWithHistory(propertyIds: string[]): Promise<Set<string>> {
  if (propertyIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ propertyId: assetsTable.propertyId })
    .from(serviceRecordsTable)
    .innerJoin(assetsTable, eq(serviceRecordsTable.assetId, assetsTable.id))
    .where(inArray(assetsTable.propertyId, propertyIds));
  return new Set(rows.map((r) => r.propertyId));
}

/**
 * Detach a property from its owner and keep it as an unclaimed dossier. Only the
 * facts pass on: assets, dates, descriptions, costs and verified status. Photos,
 * receipts, notes, service requests, collaborators and the owner's naming of the
 * home are removed. Callers delete the photo and receipt files themselves.
 */
export async function releaseProperty(tx: Tx, propertyId: string, actorUserId: string): Promise<void> {
  const [property] = await tx.select().from(propertiesTable).where(eq(propertiesTable.id, propertyId));
  if (!property) return;

  const assetIds = (
    await tx.select({ id: assetsTable.id }).from(assetsTable).where(eq(assetsTable.propertyId, propertyId))
  ).map((a) => a.id);

  if (assetIds.length > 0) {
    await tx.update(assetsTable).set({ notes: null, photoUrl: null }).where(inArray(assetsTable.id, assetIds));
    await tx
      .update(serviceRecordsTable)
      .set({ receiptUrl: null, createdByUserId: null })
      .where(inArray(serviceRecordsTable.assetId, assetIds));
    // Service requests hold the owner's phone number and free-text descriptions.
    // Completed work already lives on as verified service records.
    await tx.delete(marketplaceJobsTable).where(inArray(marketplaceJobsTable.assetId, assetIds));
  }
  await tx.delete(propertyCollaboratorsTable).where(eq(propertyCollaboratorsTable.propertyId, propertyId));

  await tx
    .update(propertiesTable)
    .set({
      userId: null,
      ownerEmail: null,
      photoUrl: null,
      name: property.address,
      releasedAt: new Date(),
      normalizedAddress: normalizeAddress(property),
      updatedAt: new Date(),
    })
    .where(eq(propertiesTable.id, propertyId));

  await recordAudit({
    actorUserId,
    action: "property.released",
    entityType: "property",
    entityId: propertyId,
    propertyId,
    details: { reason: "owner deleted account", assets: assetIds.length },
  }, tx);
}

export type UnclaimedHistory = {
  dossierIds: string[];
  assetCount: number;
  recordCount: number;
  verifiedCount: number;
};

/** Unclaimed dossiers at the same address as `property`, with a summary of their history. */
export async function findUnclaimedHistory(property: {
  id: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}): Promise<UnclaimedHistory | null> {
  const dossiers = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(
      eq(propertiesTable.normalizedAddress, normalizeAddress(property)),
      isNotNull(propertiesTable.releasedAt),
      ne(propertiesTable.id, property.id),
    ));
  if (dossiers.length === 0) return null;
  const dossierIds = dossiers.map((d) => d.id);

  const [assets] = await db
    .select({ n: count() })
    .from(assetsTable)
    .where(inArray(assetsTable.propertyId, dossierIds));
  const records = await db
    .select({ verified: serviceRecordsTable.verified })
    .from(serviceRecordsTable)
    .innerJoin(assetsTable, eq(serviceRecordsTable.assetId, assetsTable.id))
    .where(inArray(assetsTable.propertyId, dossierIds));
  if (records.length === 0) return null;

  return {
    dossierIds,
    assetCount: assets?.n ?? 0,
    recordCount: records.length,
    verifiedCount: records.filter((r) => r.verified).length,
  };
}

/**
 * Move every unclaimed dossier at the target's address into the target property.
 * Assets carry their tasks and service records with them; the emptied dossiers
 * are deleted.
 */
export async function mergeUnclaimedHistory(
  tx: Tx,
  target: { id: string; address: string; city?: string | null; state?: string | null; zipCode?: string | null },
  actorUserId: string,
): Promise<number> {
  const dossiers = await tx
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(
      eq(propertiesTable.normalizedAddress, normalizeAddress(target)),
      isNotNull(propertiesTable.releasedAt),
      ne(propertiesTable.id, target.id),
    ));
  const dossierIds = dossiers.map((d) => d.id);
  if (dossierIds.length === 0) return 0;

  const moved = await tx
    .update(assetsTable)
    .set({ propertyId: target.id, updatedAt: new Date() })
    .where(inArray(assetsTable.propertyId, dossierIds))
    .returning({ id: assetsTable.id });
  await tx.delete(propertiesTable).where(inArray(propertiesTable.id, dossierIds));

  await recordAudit({
    actorUserId,
    action: "property.history_inherited",
    entityType: "property",
    entityId: target.id,
    propertyId: target.id,
    details: { fromDossiers: dossierIds, assetsMoved: moved.length },
  }, tx);
  return moved.length;
}
