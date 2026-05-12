import { db } from "@workspace/db";
import { propertiesTable, assetsTable, propertyCollaboratorsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { clerkClient } from "@clerk/express";

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

export async function getOwnedProperty(propertyId: string, userId: string) {
  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, propertyId), eq(propertiesTable.userId, userId)));
  return property ?? null;
}

export async function getAccessibleProperty(propertyId: string, userId: string) {
  const [owned] = await db
    .select()
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, propertyId), eq(propertiesTable.userId, userId)));
  if (owned) return owned;

  const [byUserId] = await db
    .select({ property: propertiesTable })
    .from(propertyCollaboratorsTable)
    .innerJoin(propertiesTable, eq(propertyCollaboratorsTable.propertyId, propertiesTable.id))
    .where(
      and(
        eq(propertyCollaboratorsTable.propertyId, propertyId),
        eq(propertyCollaboratorsTable.acceptedUserId, userId),
        eq(propertyCollaboratorsTable.status, "accepted"),
      )
    );
  if (byUserId) return byUserId.property;

  const email = await getUserEmail(userId);
  if (email) {
    const [byEmail] = await db
      .select({ property: propertiesTable, collab: propertyCollaboratorsTable })
      .from(propertyCollaboratorsTable)
      .innerJoin(propertiesTable, eq(propertyCollaboratorsTable.propertyId, propertiesTable.id))
      .where(
        and(
          eq(propertyCollaboratorsTable.propertyId, propertyId),
          eq(propertyCollaboratorsTable.invitedEmail, email),
        )
      );
    if (byEmail) {
      await db
        .update(propertyCollaboratorsTable)
        .set({ acceptedUserId: userId, status: "accepted" })
        .where(eq(propertyCollaboratorsTable.id, byEmail.collab.id));
      return byEmail.property;
    }
  }

  return null;
}

export async function getAccessibleProperties(userId: string) {
  const [ownedProperties, collabRows] = await Promise.all([
    db.select().from(propertiesTable).where(eq(propertiesTable.userId, userId)).orderBy(propertiesTable.createdAt),
    db
      .select({ property: propertiesTable })
      .from(propertyCollaboratorsTable)
      .innerJoin(propertiesTable, eq(propertyCollaboratorsTable.propertyId, propertiesTable.id))
      .where(
        and(
          eq(propertyCollaboratorsTable.acceptedUserId, userId),
          eq(propertyCollaboratorsTable.status, "accepted"),
        )
      ),
  ]);
  const ownedIds = new Set(ownedProperties.map((p) => p.id));
  const collabProperties = collabRows.map((r) => r.property).filter((p) => !ownedIds.has(p.id));
  return [...ownedProperties, ...collabProperties];
}

export async function getOwnedAsset(assetId: string, userId: string) {
  const rows = await db
    .select({ asset: assetsTable })
    .from(assetsTable)
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(and(eq(assetsTable.id, assetId), eq(propertiesTable.userId, userId)));
  return rows[0]?.asset ?? null;
}

export async function getAccessibleAsset(assetId: string, userId: string) {
  const [row] = await db
    .select({ asset: assetsTable, propertyId: assetsTable.propertyId })
    .from(assetsTable)
    .where(eq(assetsTable.id, assetId));
  if (!row) return null;
  const property = await getAccessibleProperty(row.propertyId, userId);
  return property ? row.asset : null;
}
