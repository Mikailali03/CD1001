import { db } from "@workspace/db";
import {
  propertiesTable,
  propertyCollaboratorsTable,
  propertyTransfersTable,
  subscriptionsTable,
  TIER_PROPERTY_LIMITS,
  type PropertyTransfer,
} from "@workspace/db";
import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import { getVerifiedEmail } from "./access.js";

export type ClaimResult =
  | { ok: true; transfer: PropertyTransfer }
  | { ok: false; status: number; error: string };

/**
 * Hand a property to the signed-in user. Shared by the claim-link route and
 * the inbox so both enforce the same rules:
 *  - the user's verified email must match the transfer's recipient
 *  - the transfer must still be pending and unexpired
 *  - the new owner must have room under their plan's property limit
 * Ownership change, collaborator removal and completion happen atomically,
 * and the conditional update means two concurrent claims can't both win.
 */
export async function claimTransfer(transfer: PropertyTransfer, userId: string): Promise<ClaimResult> {
  if (transfer.status !== "pending") {
    return { ok: false, status: 410, error: "This transfer has already been completed or cancelled." };
  }
  if (transfer.expiresAt && transfer.expiresAt <= new Date()) {
    return { ok: false, status: 410, error: "This transfer link has expired. Ask the owner to send a new one." };
  }

  const email = await getVerifiedEmail(userId);
  if (!email || email !== transfer.toEmail.toLowerCase()) {
    return {
      ok: false,
      status: 403,
      error: `This transfer was sent to ${transfer.toEmail}. Sign in with that email address to accept it.`,
    };
  }

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  const limit = TIER_PROPERTY_LIMITS[sub?.tier ?? "essential"] ?? 1;
  const [{ total }] = await db
    .select({ total: count() })
    .from(propertiesTable)
    .where(eq(propertiesTable.userId, userId));
  if ((total ?? 0) >= limit) {
    return {
      ok: false,
      status: 403,
      error: "You've reached your plan's property limit. Upgrade your plan to accept this home.",
    };
  }

  const completed = await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(propertyTransfersTable)
      .set({ status: "completed", toUserId: userId, completedAt: now })
      .where(
        and(
          eq(propertyTransfersTable.id, transfer.id),
          eq(propertyTransfersTable.status, "pending"),
          or(isNull(propertyTransfersTable.expiresAt), gt(propertyTransfersTable.expiresAt, now)),
        ),
      )
      .returning();
    if (!row) return null;

    await tx
      .update(propertiesTable)
      .set({ userId, ownerEmail: email, updatedAt: now })
      .where(eq(propertiesTable.id, transfer.propertyId));
    // The previous owner's household shouldn't keep access to the new owner's home.
    await tx.delete(propertyCollaboratorsTable).where(eq(propertyCollaboratorsTable.propertyId, transfer.propertyId));
    return row;
  });

  if (!completed) {
    return { ok: false, status: 410, error: "This transfer has already been completed or cancelled." };
  }
  return { ok: true, transfer: completed };
}
