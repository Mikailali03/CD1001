import { db } from "@workspace/db";
import { propertiesTable, assetsTable, propertyCollaboratorsTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { clerkClient } from "@clerk/express";

/**
 * The user's primary email, lowercased, or null if it isn't verified.
 * Invites and transfers are addressed by email, so this is what proves the
 * signed-in user is the intended recipient.
 */
export async function getVerifiedEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
    if (!primary || primary.verification?.status !== "verified") return null;
    return primary.emailAddress.toLowerCase();
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

  // A still-pending invite addressed to the user's verified email is accepted
  // on first access. Invites already accepted by another account stay theirs.
  const email = await getVerifiedEmail(userId);
  if (email) {
    const [byEmail] = await db
      .select({ property: propertiesTable, collab: propertyCollaboratorsTable })
      .from(propertyCollaboratorsTable)
      .innerJoin(propertiesTable, eq(propertyCollaboratorsTable.propertyId, propertiesTable.id))
      .where(
        and(
          eq(propertyCollaboratorsTable.propertyId, propertyId),
          eq(propertyCollaboratorsTable.invitedEmail, email),
          eq(propertyCollaboratorsTable.status, "pending"),
        )
      );
    if (byEmail) {
      await db
        .update(propertyCollaboratorsTable)
        .set({ acceptedUserId: userId, status: "accepted" })
        .where(
          and(
            eq(propertyCollaboratorsTable.id, byEmail.collab.id),
            eq(propertyCollaboratorsTable.status, "pending"),
          )
        );
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
