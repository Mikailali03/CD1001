import { Router } from "express";
import { Readable } from "stream";
import { db } from "@workspace/db";
import { ownershipClaimsTable, propertiesTable, userProfilesTable, type OwnershipClaim } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateOwnershipClaimBody,
  ListAdminOwnershipClaimsQueryParams,
  RejectOwnershipClaimBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getOwnedProperty, getVerifiedEmail } from "../lib/access.js";
import { findUnclaimedHistory, mergeUnclaimedHistory } from "../lib/dossiers.js";
import { recordAudit, recordAuditInBackground } from "../lib/audit.js";
import { ObjectStorageService, isUploadedBy } from "../lib/objectStorage.js";
import { escapeHtml, sendEmail } from "../lib/email.js";
import { getAppUrl } from "../lib/appUrl.js";
import { logger } from "../lib/logger.js";

const router = Router();
const storage = new ObjectStorageService();
const adminAuth = [requireAuth(), requireAdmin()];

const PropertyParams = z.object({ propertyId: z.string() });
const ClaimParams = z.object({ claimId: z.string() });

function summarize(claim: OwnershipClaim) {
  return {
    id: claim.id,
    status: claim.status,
    documentType: claim.documentType,
    rejectionReason: claim.rejectionReason,
    createdAt: claim.createdAt,
    reviewedAt: claim.reviewedAt,
  };
}

// The document exists only to make a decision; once made, it's deleted.
async function deleteClaimDocument(documentPath: string | null): Promise<void> {
  if (!documentPath) return;
  try {
    const file = await storage.getObjectEntityFile(documentPath);
    await file.delete();
  } catch (err) {
    logger.warn({ err, documentPath }, "Could not delete ownership claim document");
  }
}

// ── Homeowner ────────────────────────────────────────────────────────────────

router.get("/properties/:propertyId/unclaimed-history", requireAuth(), async (req, res) => {
  const { propertyId } = PropertyParams.parse(req.params);
  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const [claim] = await db
    .select()
    .from(ownershipClaimsTable)
    .where(eq(ownershipClaimsTable.targetPropertyId, propertyId))
    .orderBy(desc(ownershipClaimsTable.createdAt))
    .limit(1);
  const history = await findUnclaimedHistory(property);

  res.json({
    available: !!history,
    assetCount: history?.assetCount ?? 0,
    recordCount: history?.recordCount ?? 0,
    verifiedCount: history?.verifiedCount ?? 0,
    claim: claim ? summarize(claim) : null,
  });
});

router.post("/properties/:propertyId/ownership-claims", requireAuth(), async (req, res) => {
  const { propertyId } = PropertyParams.parse(req.params);
  const body = CreateOwnershipClaimBody.parse(req.body);

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const history = await findUnclaimedHistory(property);
  if (!history) {
    res.status(404).json({ error: "There's no previous history to claim at this address." });
    return;
  }

  const documentPath = storage.normalizeObjectEntityPath(body.documentPath);
  if (!documentPath.startsWith("/objects/") || !isUploadedBy(documentPath, req.userId)) {
    res.status(400).json({ error: "Upload the document first." });
    return;
  }
  const upload = await storage.checkUpload(documentPath);
  if (!upload.ok) {
    res.status(upload.status).json({ error: upload.error });
    return;
  }

  const [pending] = await db
    .select({ id: ownershipClaimsTable.id })
    .from(ownershipClaimsTable)
    .where(and(eq(ownershipClaimsTable.targetPropertyId, propertyId), eq(ownershipClaimsTable.status, "pending")));
  if (pending) {
    res.status(409).json({ error: "A claim for this home is already being reviewed." });
    return;
  }

  const [claim] = await db
    .insert(ownershipClaimsTable)
    .values({
      dossierPropertyId: history.dossierIds[0]!,
      targetPropertyId: propertyId,
      claimantUserId: req.userId,
      documentType: body.documentType,
      documentPath,
    })
    .returning();

  recordAuditInBackground({
    actorUserId: req.userId,
    action: "ownership_claim.submitted",
    entityType: "ownership_claim",
    entityId: claim!.id,
    propertyId,
    details: { documentType: body.documentType, dossiers: history.dossierIds },
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    sendEmail({
      to: adminEmail,
      subject: "New ownership claim to review",
      html: `<p>A homeowner submitted proof of ownership for <strong>${escapeHtml(property.address)}</strong> to inherit its previous history.</p>
<p><a href="${getAppUrl()}/admin?tab=claims">Review it in the admin dashboard</a></p>`,
    }).catch((err) => logger.error({ err }, "Ownership claim admin email failed"));
  }

  res.status(201).json(summarize(claim!));
});

// ── Admin review ─────────────────────────────────────────────────────────────

// Owner names on public property records, to compare with a photo ID. Best effort.
async function lookupOwnerOfRecord(address: string): Promise<string[] | null> {
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Array<{ owner?: { names?: string[] } }>;
    return data[0]?.owner?.names ?? null;
  } catch {
    return null;
  }
}

async function toAdminClaim(claim: OwnershipClaim, withOwnerOfRecord: boolean) {
  const [[target], [profile]] = await Promise.all([
    db.select().from(propertiesTable).where(eq(propertiesTable.id, claim.targetPropertyId)),
    db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, claim.claimantUserId)),
  ]);
  const address = target
    ? [target.address, target.city, target.state, target.zipCode].filter(Boolean).join(", ")
    : "(property removed)";
  const history = target && claim.status === "pending" ? await findUnclaimedHistory(target) : null;
  return {
    ...summarize(claim),
    claimantUserId: claim.claimantUserId,
    claimantName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : null,
    claimantEmail: profile?.email ?? null,
    targetPropertyId: claim.targetPropertyId,
    propertyAddress: address,
    hasDocument: !!claim.documentPath,
    history: history
      ? { available: true, assetCount: history.assetCount, recordCount: history.recordCount, verifiedCount: history.verifiedCount }
      : null,
    ownerOfRecord: withOwnerOfRecord && target ? await lookupOwnerOfRecord(address) : null,
  };
}

router.get("/admin/ownership-claims", ...adminAuth, async (req, res) => {
  const { status } = ListAdminOwnershipClaimsQueryParams.parse(req.query);
  const claims = await db
    .select()
    .from(ownershipClaimsTable)
    .where(status ? eq(ownershipClaimsTable.status, status) : undefined)
    .orderBy(desc(ownershipClaimsTable.createdAt))
    .limit(100);
  res.json(await Promise.all(claims.map((c) => toAdminClaim(c, c.status === "pending"))));
});

// Streams the uploaded document to an admin. Not in the OpenAPI spec (binary).
router.get("/admin/ownership-claims/:claimId/document", ...adminAuth, async (req, res) => {
  const { claimId } = ClaimParams.parse(req.params);
  const [claim] = await db.select().from(ownershipClaimsTable).where(eq(ownershipClaimsTable.id, claimId));
  if (!claim?.documentPath) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await recordAudit({
    actorUserId: req.userId,
    action: "ownership_claim.document_viewed",
    entityType: "ownership_claim",
    entityId: claim.id,
    propertyId: claim.targetPropertyId,
  });

  try {
    const file = await storage.getObjectEntityFile(claim.documentPath);
    const response = await storage.downloadObject(file, 0);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "no-store");
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    req.log.error({ err }, "Could not stream ownership claim document");
    res.status(404).json({ error: "Document not found" });
  }
});

async function decisionEmail(claim: OwnershipClaim, subject: string, html: string): Promise<void> {
  const to = await getVerifiedEmail(claim.claimantUserId);
  if (!to) return;
  await sendEmail({ to, subject, html });
}

router.post("/admin/ownership-claims/:claimId/approve", ...adminAuth, async (req, res) => {
  const { claimId } = ClaimParams.parse(req.params);
  const [claim] = await db.select().from(ownershipClaimsTable).where(eq(ownershipClaimsTable.id, claimId));
  if (!claim || claim.status !== "pending") {
    res.status(404).json({ error: "Pending claim not found" });
    return;
  }
  const [target] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, claim.targetPropertyId));
  if (!target) {
    res.status(404).json({ error: "The claimant's property no longer exists" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const assetsMoved = await mergeUnclaimedHistory(tx, target, req.userId);
    const [updated] = await tx
      .update(ownershipClaimsTable)
      .set({ status: "approved", documentPath: null, reviewedByUserId: req.userId, reviewedAt: new Date() })
      .where(and(eq(ownershipClaimsTable.id, claimId), eq(ownershipClaimsTable.status, "pending")))
      .returning();
    // Another admin decided it first: roll back the merge.
    if (!updated) {
      tx.rollback();
      return null;
    }
    await recordAudit({
      actorUserId: req.userId,
      action: "ownership_claim.approved",
      entityType: "ownership_claim",
      entityId: claimId,
      propertyId: target.id,
      details: { documentType: claim.documentType, assetsMoved },
    }, tx);
    return updated;
  }).catch((err) => {
    if (err?.name === "TransactionRollbackError") return null;
    throw err;
  });
  if (!result) {
    res.status(409).json({ error: "Claim was already decided" });
    return;
  }

  await deleteClaimDocument(claim.documentPath);
  decisionEmail(
    claim,
    "Your home's history has been added",
    `<p>We verified your ownership of <strong>${escapeHtml(target.address)}</strong>. The previous owner's service history is now part of your Casa Dossier.</p>
<p>Your document has been deleted.</p>
<p><a href="${getAppUrl()}/properties/${target.id}">View your home</a></p>`,
  ).catch((err) => logger.error({ err }, "Ownership approval email failed"));

  res.json(await toAdminClaim(result, false));
});

router.post("/admin/ownership-claims/:claimId/reject", ...adminAuth, async (req, res) => {
  const { claimId } = ClaimParams.parse(req.params);
  const { reason } = RejectOwnershipClaimBody.parse(req.body);
  const [claim] = await db.select().from(ownershipClaimsTable).where(eq(ownershipClaimsTable.id, claimId));
  if (!claim || claim.status !== "pending") {
    res.status(404).json({ error: "Pending claim not found" });
    return;
  }

  const [updated] = await db
    .update(ownershipClaimsTable)
    .set({
      status: "rejected",
      rejectionReason: reason.trim(),
      documentPath: null,
      reviewedByUserId: req.userId,
      reviewedAt: new Date(),
    })
    .where(and(eq(ownershipClaimsTable.id, claimId), eq(ownershipClaimsTable.status, "pending")))
    .returning();
  if (!updated) {
    res.status(409).json({ error: "Claim was already decided" });
    return;
  }
  recordAuditInBackground({
    actorUserId: req.userId,
    action: "ownership_claim.rejected",
    entityType: "ownership_claim",
    entityId: claimId,
    propertyId: claim.targetPropertyId,
    details: { documentType: claim.documentType, reason: reason.trim() },
  });

  await deleteClaimDocument(claim.documentPath);
  decisionEmail(
    claim,
    "We couldn't verify your ownership",
    `<p>We couldn't verify ownership from the document you sent:</p>
<blockquote>${escapeHtml(reason.trim())}</blockquote>
<p>Your document has been deleted. You can submit a new one from your home's page in Casa Dossier.</p>`,
  ).catch((err) => logger.error({ err }, "Ownership rejection email failed"));

  res.json(await toAdminClaim(updated, false));
});

export default router;
