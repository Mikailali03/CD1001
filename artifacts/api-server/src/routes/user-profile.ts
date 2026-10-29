import { Router } from "express";
import { db } from "@workspace/db";
import {
  userProfilesTable,
  propertiesTable,
  assetsTable,
  pushTokensTable,
  subscriptionsTable,
  lockerFoldersTable,
  lockerFilesTable,
  propertyTransfersTable,
  marketplaceJobsTable,
  propertyCollaboratorsTable,
  serviceRecordsTable,
} from "@workspace/db";
import { eq, or, and, inArray, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth.js";
import { clerkClient } from "@clerk/express";
import { getUncachableStripeClient } from "../stripeClient.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { logger } from "../lib/logger.js";

const router = Router();

const UpsertBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().default(""),
  email: z.string().optional(),
  // Ignored: roles are assigned by admins via PATCH /admin/users/:userId.
  // Still accepted so older clients that send it don't get a 400.
  role: z.enum(["homeowner", "technician", "admin"]).optional(),
  phone: z.string().optional(),
});

router.get("/user/profile", requireAuth(), async (req, res) => {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId));

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

router.put("/user/profile", requireAuth(), async (req, res) => {
  const body = UpsertBody.parse(req.body);

  const values = {
    userId: req.userId,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    updatedAt: new Date(),
  };

  // role and technicianNumber are left untouched on update; new profiles
  // always start as homeowners.
  const [profile] = await db
    .insert(userProfilesTable)
    .values({ ...values, role: "homeowner", createdAt: new Date() })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: values,
    })
    .returning();

  res.json(profile);
});

router.delete("/user", requireAuth(), async (req, res): Promise<void> => {
  const userId = req.userId;

  // Prevent deletion of the demo user
  if (userId === "demo-user") {
    res.status(403).json({ error: "Cannot delete demo account" });
    return;
  }

  try {
    // ── Phase 1: read-only data gathering ────────────────────────────────────
    // Collect everything needed before touching any data. All failures here
    // are safe to retry — nothing is modified yet.

    let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>> | null = null;
    try {
      clerkUser = await clerkClient.users.getUser(userId);
    } catch (err: unknown) {
      // 404 means Clerk already deleted the user on a prior attempt — safe to
      // proceed without email data.
      const status = (err as { status?: number })?.status;
      if (status !== 404) throw err;
    }

    const userEmails = clerkUser?.emailAddresses.map((e) => e.emailAddress.toLowerCase()) ?? [];

    const [[sub], lockerFiles, ownedProperties] = await Promise.all([
      db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)),
      db.select({ id: lockerFilesTable.id, objectPath: lockerFilesTable.objectPath })
        .from(lockerFilesTable).where(eq(lockerFilesTable.userId, userId)),
      db.select({ id: propertiesTable.id, photoUrl: propertiesTable.photoUrl })
        .from(propertiesTable).where(eq(propertiesTable.userId, userId)),
    ]);

    const propertyIds = ownedProperties.map((p) => p.id);
    let assetRows: { photoUrl: string | null }[] = [];
    let receiptRows: { receiptUrl: string | null }[] = [];
    if (propertyIds.length > 0) {
      [assetRows, receiptRows] = await Promise.all([
        db.select({ photoUrl: assetsTable.photoUrl })
          .from(assetsTable).where(inArray(assetsTable.propertyId, propertyIds)),
        db.select({ receiptUrl: serviceRecordsTable.receiptUrl })
          .from(serviceRecordsTable)
          .innerJoin(assetsTable, eq(serviceRecordsTable.assetId, assetsTable.id))
          .where(inArray(assetsTable.propertyId, propertyIds)),
      ]);
    }

    // ── Phase 2: cancel Stripe subscription ──────────────────────────────────
    // MUST run before the DB transaction so the subscription ID is still in the
    // database. If cancellation fails, the endpoint returns an error and the
    // caller can safely retry — the Stripe ID remains in DB and no data has
    // been deleted yet. "Already cancelled / not found" is treated as success
    // so retries after a previous partial success complete cleanly.
    if (sub?.stripeSubscriptionId) {
      try {
        const stripe = getUncachableStripeClient();
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } catch (err: unknown) {
        const e = err as { statusCode?: number; code?: string };
        const alreadyDone =
          e?.statusCode === 404 ||
          e?.code === "resource_missing" ||
          e?.code === "subscription_already_canceled";
        if (!alreadyDone) throw err; // propagate — no data deleted yet, safe to retry
        logger.info({ userId, stripeSubId: sub.stripeSubscriptionId },
          "Stripe subscription already cancelled during account deletion");
      }
    }

    // ── Phase 3: storage blob cleanup ────────────────────────────────────────
    // Delete object-storage files BEFORE the DB transaction erases their
    // references. Individual failures are logged but do not abort: the DB rows
    // still exist at this point so paths can be recovered until the transaction
    // commits. This is the best achievable consistency without a durable outbox.
    const storageService = new ObjectStorageService();
    const allStorageUrls: string[] = [
      ...lockerFiles.map((f) => f.objectPath),
      ...(ownedProperties.map((p) => p.photoUrl).filter(Boolean) as string[]),
      ...(assetRows.map((a) => a.photoUrl).filter(Boolean) as string[]),
      ...(receiptRows.map((r) => r.receiptUrl).filter(Boolean) as string[]),
    ];
    await Promise.all(
      allStorageUrls.map(async (rawPath) => {
        try {
          const normalized = storageService.normalizeObjectEntityPath(rawPath);
          if (!normalized.startsWith("/objects/")) return; // external URL — skip
          const objectFile = await storageService.getObjectEntityFile(normalized);
          await objectFile.delete();
        } catch (err) {
          logger.warn({ err, rawPath }, "Could not delete storage object during account deletion");
        }
      })
    );

    // ── Phase 4: atomic DB deletion ──────────────────────────────────────────
    // All DB deletes run in a single transaction. A failure rolls everything
    // back — the account stays intact and the caller can retry from Phase 2.
    // Every DELETE/UPDATE is idempotent: operating on absent rows is a no-op.
    await db.transaction(async (tx) => {
      await Promise.all([
        tx.delete(lockerFilesTable).where(eq(lockerFilesTable.userId, userId)),
        tx.delete(lockerFoldersTable).where(eq(lockerFoldersTable.userId, userId)),
        tx.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId)),
        tx.delete(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)),
      ]);

      // Property transfers: no FK cascade — match userId columns AND every
      // verified email so pending invites sent to this account are removed.
      const transferConditions = [
        eq(propertyTransfersTable.fromUserId, userId),
        eq(propertyTransfersTable.toUserId, userId),
        ...userEmails.map((email) => eq(propertyTransfersTable.toEmail, email)),
      ];
      await tx.delete(propertyTransfersTable).where(or(...transferConditions));

      // Anonymize technician identity on OTHER users' service records
      // (records on own properties cascade away with the properties below).
      await tx
        .update(serviceRecordsTable)
        .set({ casaServiceTechId: null, technicianName: null, technicianNumber: null })
        .where(eq(serviceRecordsTable.casaServiceTechId, userId));

      // Marketplace jobs: active → reopen; completed → anonymize, keep record.
      const allAssignedJobs = await tx
        .select({ id: marketplaceJobsTable.id, status: marketplaceJobsTable.status })
        .from(marketplaceJobsTable)
        .where(eq(marketplaceJobsTable.technicianId, userId));

      const activeJobIds = allAssignedJobs
        .filter((j) => ["claimed", "en_route", "arrived"].includes(j.status))
        .map((j) => j.id);
      const completedJobIds = allAssignedJobs
        .filter((j) => j.status === "completed")
        .map((j) => j.id);

      const jobOps: Promise<unknown>[] = [];
      if (activeJobIds.length > 0) {
        jobOps.push(
          tx.update(marketplaceJobsTable)
            .set({ technicianId: null, technicianNumber: null, technicianName: null,
                   scheduledAt: null, acceptedAt: null, status: "open" })
            .where(inArray(marketplaceJobsTable.id, activeJobIds))
        );
      }
      if (completedJobIds.length > 0) {
        jobOps.push(
          tx.update(marketplaceJobsTable)
            .set({ technicianId: null, technicianNumber: null, technicianName: null })
            .where(inArray(marketplaceJobsTable.id, completedJobIds))
        );
      }
      await Promise.all(jobOps);

      // Collaborator records on other users' properties: accepted rows and
      // pending invites addressed to any of this user's emails.
      await Promise.all([
        tx.delete(propertyCollaboratorsTable)
          .where(eq(propertyCollaboratorsTable.acceptedUserId, userId)),
        ...userEmails.map((email) =>
          tx.delete(propertyCollaboratorsTable)
            .where(and(
              eq(propertyCollaboratorsTable.invitedEmail, email),
              isNull(propertyCollaboratorsTable.acceptedUserId)
            ))
        ),
      ]);

      // Delete owned properties — assets, maintenance tasks, service records,
      // marketplace jobs (on own assets), and collaborator rows all cascade.
      await tx.delete(propertiesTable).where(eq(propertiesTable.userId, userId));
      await tx.delete(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    });

    // ── Phase 5: delete Clerk account ────────────────────────────────────────
    // Done last. All user data is committed. A 404 means a prior attempt
    // already deleted the Clerk account — treat as success.
    try {
      await clerkClient.users.deleteUser(userId);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status !== 404) throw err;
      logger.info({ userId }, "Clerk user already deleted on a prior attempt");
    }

    res.status(204).send();
  } catch (err: unknown) {
    logger.error({ err, userId }, "Account deletion failed");
    res.status(500).json({ error: "Account deletion failed. Please try again." });
  }
});

export default router;
