import { Router } from "express";
import { db } from "@workspace/db";
import { propertyTransfersTable, propertiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedProperty } from "../lib/access.js";

const router = Router();

const InitiateParams = z.object({ propertyId: z.string() });
const InitiateBody = z.object({
  toEmail: z.string().email(),
  fromEmail: z.string().email().optional(),
});

const CancelParams = z.object({ transferId: z.string() });
const ClaimParams = z.object({ token: z.string() });
const ClaimBody = z.object({ newOwnerName: z.string().optional() });

// GET /api/properties/:propertyId/transfer — active pending transfer
router.get("/properties/:propertyId/transfer", requireAuth(), async (req, res) => {
  const { propertyId } = InitiateParams.parse(req.params);

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const [transfer] = await db
    .select()
    .from(propertyTransfersTable)
    .where(
      and(
        eq(propertyTransfersTable.propertyId, propertyId),
        eq(propertyTransfersTable.status, "pending")
      )
    )
    .orderBy(propertyTransfersTable.createdAt)
    .limit(1);
  res.json(transfer ?? null);
});

// POST /api/properties/:propertyId/transfer — initiate
router.post("/properties/:propertyId/transfer", requireAuth(), async (req, res) => {
  const { propertyId } = InitiateParams.parse(req.params);
  const { toEmail, fromEmail } = InitiateBody.parse(req.body);

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const senderEmail = fromEmail ?? req.userId;

  if (toEmail.toLowerCase() === senderEmail.toLowerCase()) {
    return res.status(400).json({ error: "You cannot transfer to yourself." });
  }

  // Cancel any existing pending transfer
  await db
    .update(propertyTransfersTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(propertyTransfersTable.propertyId, propertyId),
        eq(propertyTransfersTable.status, "pending")
      )
    );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [transfer] = await db
    .insert(propertyTransfersTable)
    .values({
      propertyId,
      fromUserId: req.userId,
      fromEmail: senderEmail,
      toEmail,
      status: "pending",
      expiresAt,
    })
    .returning();

  res.status(201).json(transfer);
});

// DELETE /api/transfers/:transferId — cancel
router.delete("/transfers/:transferId", requireAuth(), async (req, res) => {
  const { transferId } = CancelParams.parse(req.params);

  const [existing] = await db
    .select()
    .from(propertyTransfersTable)
    .where(eq(propertyTransfersTable.id, transferId));

  if (!existing) return res.status(404).json({ error: "Transfer not found or already resolved" });

  // Verify the requesting user owns the source property
  const property = await getOwnedProperty(existing.propertyId, req.userId);
  if (!property) return res.status(403).json({ error: "Forbidden" });

  const [transfer] = await db
    .update(propertyTransfersTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(propertyTransfersTable.id, transferId),
        eq(propertyTransfersTable.status, "pending")
      )
    )
    .returning();
  if (!transfer) return res.status(404).json({ error: "Transfer not found or already resolved" });
  res.json(transfer);
});

// GET /api/transfers/claim/:token — fetch transfer details (public, for claim page)
router.get("/transfers/claim/:token", async (req, res) => {
  const { token } = ClaimParams.parse(req.params);
  const [transfer] = await db
    .select()
    .from(propertyTransfersTable)
    .where(eq(propertyTransfersTable.token, token));
  if (!transfer) return res.status(404).json({ error: "Invalid or expired transfer link." });
  if (transfer.status !== "pending") {
    return res.status(410).json({ error: "This transfer has already been completed or cancelled.", status: transfer.status });
  }

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, transfer.propertyId));

  res.json({ transfer, property: property ?? null });
});

// POST /api/transfers/claim/:token — accept (requires auth — the signed-in user becomes the new owner)
router.post("/transfers/claim/:token", requireAuth(), async (req, res) => {
  const { token } = ClaimParams.parse(req.params);
  ClaimBody.parse(req.body);

  const [transfer] = await db
    .select()
    .from(propertyTransfersTable)
    .where(eq(propertyTransfersTable.token, token));

  if (!transfer) return res.status(404).json({ error: "Invalid or expired transfer link." });
  if (transfer.status !== "pending") {
    return res.status(410).json({ error: "This transfer has already been completed or cancelled.", status: transfer.status });
  }

  const newUserId = req.userId;

  await db
    .update(propertiesTable)
    .set({ userId: newUserId, updatedAt: new Date() })
    .where(eq(propertiesTable.id, transfer.propertyId));

  const [completed] = await db
    .update(propertyTransfersTable)
    .set({
      status: "completed",
      toUserId: newUserId,
      completedAt: new Date(),
    })
    .where(eq(propertyTransfersTable.id, transfer.id))
    .returning();

  res.json({ transfer: completed, newUserId });
});

export default router;
