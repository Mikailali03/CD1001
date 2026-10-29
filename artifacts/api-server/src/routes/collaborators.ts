import { Router } from "express";
import { db } from "@workspace/db";
import { propertyCollaboratorsTable, subscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedProperty, getVerifiedEmail } from "../lib/access.js";
import { sendCollaboratorInviteEmail } from "../lib/email.js";
import { z } from "zod/v4";

const router = Router();

const PropertyParams = z.object({ propertyId: z.string() });
const CollaboratorParams = z.object({ propertyId: z.string(), collaboratorId: z.string() });

const MANAGED_TIERS = ["managed", "concierge"];

async function requireManagedTier(userId: string): Promise<boolean> {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);
  return sub ? MANAGED_TIERS.includes(sub.tier) : false;
}

router.get("/properties/:propertyId/collaborators", requireAuth(), async (req, res) => {
  const { propertyId } = PropertyParams.parse(req.params);
  const userId = req.userId!;

  const property = await getOwnedProperty(propertyId, userId);
  if (!property) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const collaborators = await db
    .select()
    .from(propertyCollaboratorsTable)
    .where(eq(propertyCollaboratorsTable.propertyId, propertyId))
    .orderBy(propertyCollaboratorsTable.createdAt);

  res.json(collaborators);
});

const inviteSchema = z.object({ email: z.email() });

router.post("/properties/:propertyId/collaborators", requireAuth(), async (req, res) => {
  const { propertyId } = PropertyParams.parse(req.params);
  const userId = req.userId!;

  const property = await getOwnedProperty(propertyId, userId);
  if (!property) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const isManagedPlus = await requireManagedTier(userId);
  if (!isManagedPlus) {
    res.status(403).json({ error: "Collaborators require a Managed or Concierge plan." });
    return;
  }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  const { email } = parsed.data;

  const existing = await db
    .select()
    .from(propertyCollaboratorsTable)
    .where(
      and(
        eq(propertyCollaboratorsTable.propertyId, propertyId),
        eq(propertyCollaboratorsTable.invitedEmail, email.toLowerCase()),
      )
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "This email has already been invited." });
    return;
  }

  const [created] = await db
    .insert(propertyCollaboratorsTable)
    .values({
      propertyId,
      invitedByUserId: userId,
      invitedEmail: email.toLowerCase(),
    })
    .returning();

  getVerifiedEmail(userId)
    .then((inviterEmail) =>
      sendCollaboratorInviteEmail({ toEmail: email.toLowerCase(), inviterEmail, property }),
    )
    .catch((err) => req.log.error({ err, collaboratorId: created!.id }, "Failed to send collaborator invite email"));

  res.status(201).json(created);
});

router.delete("/properties/:propertyId/collaborators/:collaboratorId", requireAuth(), async (req, res) => {
  const { propertyId, collaboratorId } = CollaboratorParams.parse(req.params);
  const userId = req.userId!;

  const property = await getOwnedProperty(propertyId, userId);
  if (!property) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .delete(propertyCollaboratorsTable)
    .where(
      and(
        eq(propertyCollaboratorsTable.id, collaboratorId),
        eq(propertyCollaboratorsTable.propertyId, propertyId),
      )
    );

  res.status(204).send();
});

export default router;
