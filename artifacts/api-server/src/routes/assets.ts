import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable, type Asset } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
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

  res.json(assets);
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
  res.json(asset);
});

router.patch("/assets/:assetId", requireAuth(), async (req, res) => {
  const { assetId } = UpdateAssetParams.parse(req.params);
  const body = UpdateAssetBody.parse(req.body);

  const existing = await getAccessibleAsset(assetId, req.userId);
  if (!existing) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const setValues: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if ("installDate" in body) setValues.installDate = toDateOnly(body.installDate) ?? null;
  if ("warrantyExpiry" in body) setValues.warrantyExpiry = toDateOnly(body.warrantyExpiry) ?? null;
  if ("retiredAt" in body) {
    setValues.retiredAt = body.retiredAt ?? null;
  }

  const [asset] = await db
    .update(assetsTable)
    .set(setValues)
    .where(eq(assetsTable.id, assetId))
    .returning();
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.json(asset);
});

// Hard delete cascades to every task and service record, so it's owner-only.
// Collaborators can still retire an asset via PATCH retiredAt.
router.delete("/assets/:assetId", requireAuth(), async (req, res) => {
  const { assetId } = DeleteAssetParams.parse(req.params);
  const existing = await getOwnedAsset(assetId, req.userId);
  if (!existing) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  await db.delete(assetsTable).where(eq(assetsTable.id, assetId));
  res.status(204).send();
});

export default router;
