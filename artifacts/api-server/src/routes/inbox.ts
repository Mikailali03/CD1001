import { Router } from "express";
import { db } from "@workspace/db";
import {
  propertyTransfersTable,
  propertyCollaboratorsTable,
  propertiesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { clerkClient } from "@clerk/express";

const router = Router();

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

// GET /api/inbox — pending transfers + collaborator invites addressed to the current user
router.get("/inbox", requireAuth(), async (req, res) => {
  const userId = req.userId!;
  const email = await getUserEmail(userId);
  if (!email) return res.json({ transfers: [], collaboratorInvites: [] });

  const [transfers, collaboratorInvites] = await Promise.all([
    db
      .select({ transfer: propertyTransfersTable, property: propertiesTable })
      .from(propertyTransfersTable)
      .innerJoin(propertiesTable, eq(propertyTransfersTable.propertyId, propertiesTable.id))
      .where(
        and(
          eq(propertyTransfersTable.toEmail, email.toLowerCase()),
          eq(propertyTransfersTable.status, "pending"),
        )
      ),
    db
      .select({ collab: propertyCollaboratorsTable, property: propertiesTable })
      .from(propertyCollaboratorsTable)
      .innerJoin(propertiesTable, eq(propertyCollaboratorsTable.propertyId, propertiesTable.id))
      .where(
        and(
          eq(propertyCollaboratorsTable.invitedEmail, email.toLowerCase()),
          eq(propertyCollaboratorsTable.status, "pending"),
        )
      ),
  ]);

  return res.json({
    transfers: transfers.map((r) => ({ ...r.transfer, property: r.property })),
    collaboratorInvites: collaboratorInvites.map((r) => ({ ...r.collab, property: r.property })),
  });
});

// POST /api/inbox/transfers/:id/claim — accept a deed transfer
router.post("/inbox/transfers/:id/claim", requireAuth(), async (req, res) => {
  const { id } = req.params;
  const userId = req.userId!;
  const email = await getUserEmail(userId);
  if (!email) return res.status(403).json({ error: "Could not verify your email." });

  const [transfer] = await db
    .select()
    .from(propertyTransfersTable)
    .where(
      and(
        eq(propertyTransfersTable.id, id),
        eq(propertyTransfersTable.toEmail, email.toLowerCase()),
        eq(propertyTransfersTable.status, "pending"),
      )
    );

  if (!transfer) return res.status(404).json({ error: "Transfer not found or already resolved." });

  await db.transaction(async (tx) => {
    await tx
      .update(propertiesTable)
      .set({ userId })
      .where(eq(propertiesTable.id, transfer.propertyId));
    await tx
      .update(propertyTransfersTable)
      .set({ status: "completed", toUserId: userId, completedAt: new Date() })
      .where(eq(propertyTransfersTable.id, id));
  });

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, transfer.propertyId));

  return res.json({ property });
});

// POST /api/inbox/collaborators/:id/accept — accept a collaborator invite
router.post("/inbox/collaborators/:id/accept", requireAuth(), async (req, res) => {
  const { id } = req.params;
  const userId = req.userId!;
  const email = await getUserEmail(userId);
  if (!email) return res.status(403).json({ error: "Could not verify your email." });

  const [collab] = await db
    .select()
    .from(propertyCollaboratorsTable)
    .where(
      and(
        eq(propertyCollaboratorsTable.id, id),
        eq(propertyCollaboratorsTable.invitedEmail, email.toLowerCase()),
        eq(propertyCollaboratorsTable.status, "pending"),
      )
    );

  if (!collab) return res.status(404).json({ error: "Invite not found or already resolved." });

  await db
    .update(propertyCollaboratorsTable)
    .set({ acceptedUserId: userId, status: "accepted" })
    .where(eq(propertyCollaboratorsTable.id, id));

  return res.json({ ok: true });
});

// DELETE /api/inbox/collaborators/:id — decline a collaborator invite
router.delete("/inbox/collaborators/:id", requireAuth(), async (req, res) => {
  const { id } = req.params;
  const userId = req.userId!;
  const email = await getUserEmail(userId);
  if (!email) return res.status(403).json({ error: "Could not verify your email." });

  await db
    .delete(propertyCollaboratorsTable)
    .where(
      and(
        eq(propertyCollaboratorsTable.id, id),
        eq(propertyCollaboratorsTable.invitedEmail, email.toLowerCase()),
      )
    );

  return res.status(204).send();
});

export default router;
