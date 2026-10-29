import { Router } from "express";
import { db } from "@workspace/db";
import { propertyTransfersTable, propertiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedProperty, getVerifiedEmail } from "../lib/access.js";
import { claimTransfer } from "../lib/transfers.js";
import { sendTransferInitiatedEmail } from "../lib/email.js";

const router = Router();

const InitiateParams = z.object({ propertyId: z.string() });
const InitiateBody = z.object({
  toEmail: z.string().email(),
  // Ignored — the sender's email comes from their verified Clerk account.
  // Still accepted so older clients that send it don't get a 400.
  fromEmail: z.string().email().optional(),
});

const CancelParams = z.object({ transferId: z.string() });
const ClaimParams = z.object({ token: z.string() });
const ClaimBody = z.object({ newOwnerName: z.string().optional() });

// GET /api/properties/:propertyId/transfer — active pending transfer
router.get("/properties/:propertyId/transfer", requireAuth(), async (req, res) => {
  const { propertyId } = InitiateParams.parse(req.params);

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

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
  const body = InitiateBody.parse(req.body);
  const toEmail = body.toEmail.toLowerCase();

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const senderEmail = await getVerifiedEmail(req.userId);
  if (!senderEmail) {
    res.status(403).json({ error: "Verify your email address before transferring a home." });
    return;
  }

  if (toEmail === senderEmail) {
    res.status(400).json({ error: "You cannot transfer to yourself." });
    return;
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

  sendTransferInitiatedEmail({
    toEmail,
    senderEmail,
    property,
    token: transfer!.token,
    expiresAt: transfer!.expiresAt,
  }).catch((err) => req.log.error({ err, transferId: transfer!.id }, "Failed to send transfer email"));

  res.status(201).json(transfer);
});

// DELETE /api/transfers/:transferId — cancel
router.delete("/transfers/:transferId", requireAuth(), async (req, res) => {
  const { transferId } = CancelParams.parse(req.params);

  const [existing] = await db
    .select()
    .from(propertyTransfersTable)
    .where(eq(propertyTransfersTable.id, transferId));

  if (!existing) {
    res.status(404).json({ error: "Transfer not found or already resolved" });
    return;
  }

  // Verify the requesting user owns the source property
  const property = await getOwnedProperty(existing.propertyId, req.userId);
  if (!property) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

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
  if (!transfer) {
    res.status(404).json({ error: "Transfer not found or already resolved" });
    return;
  }
  res.json(transfer);
});

// GET /api/transfers/claim/:token — fetch transfer details (public, for claim page)
router.get("/transfers/claim/:token", async (req, res) => {
  const { token } = ClaimParams.parse(req.params);
  const [transfer] = await db
    .select()
    .from(propertyTransfersTable)
    .where(eq(propertyTransfersTable.token, token));
  if (!transfer) {
    res.status(404).json({ error: "Invalid or expired transfer link." });
    return;
  }
  if (transfer.status !== "pending") {
    res.status(410).json({ error: "This transfer has already been completed or cancelled.", status: transfer.status });
    return;
  }

  if (transfer.expiresAt && transfer.expiresAt <= new Date()) {
    res.status(410).json({ error: "This transfer link has expired.", status: "expired" });
    return;
  }

  // Unauthenticated endpoint: return only what the claim page displays.
  const [property] = await db
    .select({
      id: propertiesTable.id,
      name: propertiesTable.name,
      address: propertiesTable.address,
      city: propertiesTable.city,
      state: propertiesTable.state,
      yearBuilt: propertiesTable.yearBuilt,
      sqft: propertiesTable.sqft,
    })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, transfer.propertyId));

  res.json({
    transfer: {
      id: transfer.id,
      status: transfer.status,
      fromEmail: transfer.fromEmail,
      toEmail: transfer.toEmail,
      expiresAt: transfer.expiresAt,
      createdAt: transfer.createdAt,
    },
    property: property ?? null,
  });
});

// POST /api/transfers/claim/:token — accept (requires auth — the signed-in user becomes the new owner)
router.post("/transfers/claim/:token", requireAuth(), async (req, res) => {
  const { token } = ClaimParams.parse(req.params);
  ClaimBody.parse(req.body);

  const [transfer] = await db
    .select()
    .from(propertyTransfersTable)
    .where(eq(propertyTransfersTable.token, token));

  if (!transfer) {
    res.status(404).json({ error: "Invalid or expired transfer link." });
    return;
  }

  const result = await claimTransfer(transfer, req.userId);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({ transfer: result.transfer, newUserId: req.userId });
});

export default router;
