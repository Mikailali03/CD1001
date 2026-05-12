import { Router } from "express";
import { db } from "@workspace/db";
import { propertyCollaboratorsTable, subscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedProperty } from "../lib/access.js";
import { z } from "zod/v4";

const router = Router();

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
  const { propertyId } = req.params;
  const userId = req.userId!;

  const property = await getOwnedProperty(propertyId, userId);
  if (!property) return res.status(403).json({ error: "Forbidden" });

  const collaborators = await db
    .select()
    .from(propertyCollaboratorsTable)
    .where(eq(propertyCollaboratorsTable.propertyId, propertyId))
    .orderBy(propertyCollaboratorsTable.createdAt);

  return res.json(collaborators);
});

const inviteSchema = z.object({ email: z.email() });

router.post("/properties/:propertyId/collaborators", requireAuth(), async (req, res) => {
  const { propertyId } = req.params;
  const userId = req.userId!;

  const property = await getOwnedProperty(propertyId, userId);
  if (!property) return res.status(403).json({ error: "Forbidden" });

  const isManagedPlus = await requireManagedTier(userId);
  if (!isManagedPlus) {
    return res.status(403).json({ error: "Collaborators require a Managed or Concierge plan." });
  }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email address." });

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
    return res.status(409).json({ error: "This email has already been invited." });
  }

  const [created] = await db
    .insert(propertyCollaboratorsTable)
    .values({
      propertyId,
      invitedByUserId: userId,
      invitedEmail: email.toLowerCase(),
    })
    .returning();

  return res.status(201).json(created);
});

router.delete("/properties/:propertyId/collaborators/:collaboratorId", requireAuth(), async (req, res) => {
  const { propertyId, collaboratorId } = req.params;
  const userId = req.userId!;

  const property = await getOwnedProperty(propertyId, userId);
  if (!property) return res.status(403).json({ error: "Forbidden" });

  await db
    .delete(propertyCollaboratorsTable)
    .where(
      and(
        eq(propertyCollaboratorsTable.id, collaboratorId),
        eq(propertyCollaboratorsTable.propertyId, propertyId),
      )
    );

  return res.status(204).send();
});

export default router;
