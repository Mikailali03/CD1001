import { db } from "@workspace/db";
import { propertiesTable, assetsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function getOwnedProperty(propertyId: string, userId: string) {
  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, propertyId), eq(propertiesTable.userId, userId)));
  return property ?? null;
}

export async function getOwnedAsset(assetId: string, userId: string) {
  const rows = await db
    .select({ asset: assetsTable })
    .from(assetsTable)
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(and(eq(assetsTable.id, assetId), eq(propertiesTable.userId, userId)));
  return rows[0]?.asset ?? null;
}
