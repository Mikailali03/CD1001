// Who may read a stored photo or receipt. Files are referenced by URL from three
// columns (property photo, asset photo, service-record receipt); access follows
// the home they belong to. Locker files and ownership documents are handled
// separately in routes/storage.ts.
import { db } from "@workspace/db";
import { assetsTable, propertiesTable, serviceRecordsTable, userProfilesTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { getAccessibleProperty } from "./access.js";
import { isUploadedBy } from "./objectStorage.js";

// Stored URLs look like `/api/storage/objects/...` or `<base>/api/storage/objects/...`.
async function owningPropertyIds(objectPath: string): Promise<string[]> {
  const suffix = `%/api/storage${objectPath}`;
  const [properties, assets, receipts] = await Promise.all([
    db.select({ propertyId: propertiesTable.id }).from(propertiesTable).where(like(propertiesTable.photoUrl, suffix)),
    db.select({ propertyId: assetsTable.propertyId }).from(assetsTable).where(like(assetsTable.photoUrl, suffix)),
    db
      .select({ propertyId: assetsTable.propertyId })
      .from(serviceRecordsTable)
      .innerJoin(assetsTable, eq(serviceRecordsTable.assetId, assetsTable.id))
      .where(like(serviceRecordsTable.receiptUrl, suffix)),
  ]);
  return [...new Set([...properties, ...assets, ...receipts].map((r) => r.propertyId))];
}

async function isAdmin(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({ role: userProfilesTable.role })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  return profile?.role === "admin";
}

/**
 * True if `userId` may read the object: anyone with access to the home it
 * belongs to, or an admin. A file not yet attached to anything (just uploaded,
 * shown as a preview) is readable only by the person who uploaded it.
 */
export async function canReadObject(objectPath: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const propertyIds = await owningPropertyIds(objectPath);
  if (propertyIds.length === 0) return isUploadedBy(objectPath, userId) || isAdmin(userId);
  for (const propertyId of propertyIds) {
    if (await getAccessibleProperty(propertyId, userId)) return true;
  }
  return isAdmin(userId);
}
