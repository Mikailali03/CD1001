import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable, maintenanceTasksTable, propertiesTable, serviceRecordsTable, userProfilesTable, type Asset } from "@workspace/db";
import { eq, and, isNull, count } from "drizzle-orm";
import {
  CreateAssetBody,
  CreateAssetParams,
  GetAssetParams,
  UpdateAssetBody,
  UpdateAssetParams,
  DeleteAssetParams,
  ListAssetsParams,
  ListAssetsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty, getAccessibleAsset, getOwnedAsset } from "../lib/access.js";
import { toDateOnly } from "../lib/dates.js";
import { recordAudit, recordAuditInBackground } from "../lib/audit.js";
import { loadAssetServiceContext, withHealth } from "../lib/assetHealth.js";
import { assetRemovalBlockReason, assetUpdateBlockReason, assetUpdateIntent } from "../lib/assetRules.js";

const router = Router();

router.get("/properties/:propertyId/assets", requireAuth(), async (req, res) => {
  const { propertyId } = ListAssetsParams.parse(req.params);
  const query = ListAssetsQueryParams.parse(req.query);
  const includeRetired = req.query.includeRetired === "true";

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const conditions = [eq(assetsTable.propertyId, propertyId)];
  if (query.category) {
    conditions.push(eq(assetsTable.category, query.category as Asset["category"]));
  }
  if (!includeRetired) {
    conditions.push(isNull(assetsTable.retiredAt));
  }

  const assets = await db
    .select()
    .from(assetsTable)
    .where(and(...conditions))
    .orderBy(assetsTable.createdAt);

  const ctx = await loadAssetServiceContext(assets.map((a) => a.id), property.state);
  res.json(assets.map((a) => withHealth(a, ctx)));
});

router.post("/properties/:propertyId/assets", requireAuth(), async (req, res) => {
  const { propertyId } = CreateAssetParams.parse(req.params);
  const body = CreateAssetBody.parse(req.body);

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const [asset] = await db
    .insert(assetsTable)
    .values({
      ...body,
      propertyId,
      // numeric column: drizzle types it as a string, pg accepts either
      replacementCost: body.replacementCost?.toString(),
      installDate: toDateOnly(body.installDate),
      warrantyExpiry: toDateOnly(body.warrantyExpiry),
    })
    .returning();
  res.status(201).json(asset);
});

router.get("/assets/:assetId", requireAuth(), async (req, res) => {
  const { assetId } = GetAssetParams.parse(req.params);
  const asset = await getAccessibleAsset(assetId, req.userId);
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  const [property] = await db
    .select({ state: propertiesTable.state })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, asset.propertyId));
  const ctx = await loadAssetServiceContext([asset.id], property?.state);
  res.json(withHealth(asset, ctx));
});

router.patch("/assets/:assetId", requireAuth(), async (req, res) => {
  const { assetId } = UpdateAssetParams.parse(req.params);
  const body = UpdateAssetBody.parse(req.body);

  const existing = await getAccessibleAsset(assetId, req.userId);
  if (!existing) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const { retiring, reactivating } = assetUpdateIntent(existing, body);
  const blocked = assetUpdateBlockReason(existing, body);
  if (blocked) {
    res.status(blocked.status).json({ error: blocked.error });
    return;
  }

  const { retiredAt: _retiredAt, retiredReason: _retiredReason, ...edits } = body;
  const setValues: Record<string, unknown> = { ...edits, updatedAt: new Date() };
  if ("installDate" in body) setValues.installDate = toDateOnly(body.installDate) ?? null;
  if ("warrantyExpiry" in body) setValues.warrantyExpiry = toDateOnly(body.warrantyExpiry) ?? null;
  if (retiring) {
    setValues.retiredAt = body.retiredAt;
    setValues.retiredReason = body.retiredReason;
  }
  if (reactivating) {
    setValues.retiredAt = null;
    setValues.retiredReason = null;
  }

  const asset = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(assetsTable)
      .set(setValues)
      .where(eq(assetsTable.id, assetId))
      .returning();
    if (!updated) return null;

    if (retiring) {
      // Retired assets get no more maintenance: drop the open tasks so they
      // leave the inbox and stop generating reminders.
      const closed = await tx
        .delete(maintenanceTasksTable)
        .where(and(eq(maintenanceTasksTable.assetId, assetId), isNull(maintenanceTasksTable.completedAt)))
        .returning({ id: maintenanceTasksTable.id });
      await recordAudit({
        actorUserId: req.userId,
        action: "asset.retired",
        entityType: "asset",
        entityId: assetId,
        propertyId: existing.propertyId,
        details: { reason: body.retiredReason, retiredAt: body.retiredAt, openTasksClosed: closed.length },
      }, tx);
    } else if (reactivating) {
      await recordAudit({
        actorUserId: req.userId,
        action: "asset.reactivated",
        entityType: "asset",
        entityId: assetId,
        propertyId: existing.propertyId,
        details: { previousReason: existing.retiredReason, previousRetiredAt: existing.retiredAt },
      }, tx);
    }

    const changed = Object.keys(edits).filter(
      (k) => (existing as Record<string, unknown>)[k] !== (updated as Record<string, unknown>)[k],
    );
    if (changed.length > 0) {
      await recordAudit({
        actorUserId: req.userId,
        action: "asset.updated",
        entityType: "asset",
        entityId: assetId,
        propertyId: existing.propertyId,
        details: Object.fromEntries(
          changed.map((k) => [k, {
            from: (existing as Record<string, unknown>)[k] ?? null,
            to: (updated as Record<string, unknown>)[k] ?? null,
          }]),
        ),
      }, tx);
    }
    return updated;
  });

  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  const [property] = await db
    .select({ state: propertiesTable.state })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, asset.propertyId));
  const ctx = await loadAssetServiceContext([asset.id], property?.state);
  res.json(withHealth(asset, ctx));
});

// Deleting cascades to every task and service record, so owners may only remove
// an asset added by mistake (no history, under 7 days old). Everything else is
// retired via PATCH retiredAt so the report keeps it. Admins can remove anything.
router.delete("/assets/:assetId", requireAuth(), async (req, res) => {
  const { assetId } = DeleteAssetParams.parse(req.params);

  const [profile] = await db
    .select({ role: userProfilesTable.role })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId));
  const isAdmin = profile?.role === "admin";

  const [existing] = isAdmin
    ? await db.select().from(assetsTable).where(eq(assetsTable.id, assetId))
    : [await getOwnedAsset(assetId, req.userId)];
  if (!existing) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const [{ records }] = await db
    .select({ records: count() })
    .from(serviceRecordsTable)
    .where(eq(serviceRecordsTable.assetId, assetId));

  const removalBlocked = assetRemovalBlockReason({ isAdmin, serviceRecordCount: records, createdAt: existing.createdAt });
  if (removalBlocked) {
    res.status(409).json({ error: removalBlocked });
    return;
  }

  await db.delete(assetsTable).where(eq(assetsTable.id, assetId));
  recordAuditInBackground({
    actorUserId: req.userId,
    action: isAdmin ? "asset.deleted_by_admin" : "asset.removed_as_mistake",
    entityType: "asset",
    entityId: assetId,
    propertyId: existing.propertyId,
    details: { name: existing.name, category: existing.category, serviceRecords: records },
  });
  res.status(204).send();
});

export default router;
