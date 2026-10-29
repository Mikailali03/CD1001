import { Router } from "express";
import { db } from "@workspace/db";
import {
  propertyTransfersTable,
  propertyCollaboratorsTable,
  propertiesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getVerifiedEmail } from "../lib/access.js";
import { claimTransfer } from "../lib/transfers.js";
import { z } from "zod";

const router = Router();

const IdParams = z.object({ id: z.string() });

// GET /api/inbox — pending transfers + collaborator invites addressed to the current user
router.get("/inbox", requireAuth(), async (req, res) => {
  const userId = req.userId!;
  const email = await getVerifiedEmail(userId);
  if (!email) {
    res.json({ transfers: [], collaboratorInvites: [] });
    return;
  }

  const [transfers, collaboratorInvites] = await Promise.all([
    db
      .select({ transfer: propertyTransfersTable, property: propertiesTable })
      .from(propertyTransfersTable)
      .innerJoin(propertiesTable, eq(propertyTransfersTable.propertyId, propertiesTable.id))
      .where(
        and(
          sql`lower(${propertyTransfersTable.toEmail}) = ${email}`,
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

  res.json({
    transfers: transfers.map((r) => ({ ...r.transfer, property: r.property })),
    collaboratorInvites: collaboratorInvites.map((r) => ({ ...r.collab, property: r.property })),
  });
});

// POST /api/inbox/transfers/:id/claim — accept a deed transfer
router.post("/inbox/transfers/:id/claim", requireAuth(), async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const userId = req.userId!;
  const email = await getVerifiedEmail(userId);
  if (!email) {
    res.status(403).json({ error: "Could not verify your email." });
    return;
  }

  const [transfer] = await db
    .select()
    .from(propertyTransfersTable)
    .where(
      and(
        eq(propertyTransfersTable.id, id),
        // Older transfers stored toEmail as typed; compare case-insensitively.
        sql`lower(${propertyTransfersTable.toEmail}) = ${email}`,
      )
    );

  if (!transfer) {
    res.status(404).json({ error: "Transfer not found or already resolved." });
    return;
  }

  const result = await claimTransfer(transfer, userId);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, transfer.propertyId));

  res.json({ property });
});

// POST /api/inbox/collaborators/:id/accept — accept a collaborator invite
router.post("/inbox/collaborators/:id/accept", requireAuth(), async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const userId = req.userId!;
  const email = await getVerifiedEmail(userId);
  if (!email) {
    res.status(403).json({ error: "Could not verify your email." });
    return;
  }

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

  if (!collab) {
    res.status(404).json({ error: "Invite not found or already resolved." });
    return;
  }

  await db
    .update(propertyCollaboratorsTable)
    .set({ acceptedUserId: userId, status: "accepted" })
    .where(eq(propertyCollaboratorsTable.id, id));

  res.json({ ok: true });
});

// DELETE /api/inbox/collaborators/:id — decline a collaborator invite
router.delete("/inbox/collaborators/:id", requireAuth(), async (req, res) => {
  const { id } = IdParams.parse(req.params);
  const userId = req.userId!;
  const email = await getVerifiedEmail(userId);
  if (!email) {
    res.status(403).json({ error: "Could not verify your email." });
    return;
  }

  await db
    .delete(propertyCollaboratorsTable)
    .where(
      and(
        eq(propertyCollaboratorsTable.id, id),
        eq(propertyCollaboratorsTable.invitedEmail, email.toLowerCase()),
      )
    );

  res.status(204).send();
});

export default router;
