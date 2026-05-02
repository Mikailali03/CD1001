import { Router } from "express";
import { db } from "@workspace/db";
import { propertyTransfersTable, propertiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const InitiateParams = z.object({ propertyId: z.string() });
const InitiateBody = z.object({
  toEmail: z.string().email(),
  fromEmail: z.string().email().optional().default("alex@example.com"),
});

const CancelParams = z.object({ transferId: z.string() });
const ClaimParams = z.object({ token: z.string() });
const ClaimBody = z.object({ newOwnerName: z.string().optional() });

// GET /api/properties/:propertyId/transfer — active pending transfer
router.get("/properties/:propertyId/transfer", async (req, res) => {
  const { propertyId } = InitiateParams.parse(req.params);
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
router.post("/properties/:propertyId/transfer", async (req, res) => {
  const { propertyId } = InitiateParams.parse(req.params);
  const { toEmail, fromEmail } = InitiateBody.parse(req.body);

  // Verify property exists
  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, propertyId));
  if (!property) return res.status(404).json({ error: "Property not found" });

  if (toEmail.toLowerCase() === fromEmail.toLowerCase()) {
    return res.status(400).json({ error: "You cannot transfer to yourself." });
  }

  // Cancel any existing pending transfer before creating a new one
  await db
    .update(propertyTransfersTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(propertyTransfersTable.propertyId, propertyId),
        eq(propertyTransfersTable.status, "pending")
      )
    );

  // Compute 30-day expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [transfer] = await db
    .insert(propertyTransfersTable)
    .values({
      propertyId,
      fromUserId: property.userId,
      fromEmail,
      toEmail,
      status: "pending",
      expiresAt,
    })
    .returning();

  res.status(201).json(transfer);
});

// DELETE /api/transfers/:transferId — cancel escrow
router.delete("/transfers/:transferId", async (req, res) => {
  const { transferId } = CancelParams.parse(req.params);
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

// GET /api/transfers/claim/:token — fetch transfer details for claim page
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

  // Fetch property info to show on the claim page
  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, transfer.propertyId));

  res.json({ transfer, property: property ?? null });
});

// POST /api/transfers/claim/:token — accept the transfer
router.post("/transfers/claim/:token", async (req, res) => {
  const { token } = ClaimParams.parse(req.params);
  const { newOwnerName } = ClaimBody.parse(req.body);

  const [transfer] = await db
    .select()
    .from(propertyTransfersTable)
    .where(eq(propertyTransfersTable.token, token));

  if (!transfer) return res.status(404).json({ error: "Invalid or expired transfer link." });
  if (transfer.status !== "pending") {
    return res.status(410).json({ error: "This transfer has already been completed or cancelled.", status: transfer.status });
  }

  // Perform ownership transfer — new userId = toEmail (as identifier)
  const newUserId = transfer.toEmail;

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
