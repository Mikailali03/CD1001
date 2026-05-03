import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db";
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
import { getOwnedProperty, getOwnedAsset } from "../lib/access.js";

const router = Router();

router.get("/properties/:propertyId/assets", requireAuth(), async (req, res) => {
  const { propertyId } = ListAssetsParams.parse(req.params);
  const query = ListAssetsQueryParams.parse(req.query);
  const includeRetired = req.query.includeRetired === "true";

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const conditions = [eq(assetsTable.propertyId, propertyId)];
  if (query.category) {
    conditions.push(eq(assetsTable.category, query.category));
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

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const [asset] = await db.insert(assetsTable).values({ ...body, propertyId }).returning();
  res.status(201).json(asset);
});

router.get("/assets/:assetId", requireAuth(), async (req, res) => {
  const { assetId } = GetAssetParams.parse(req.params);
  const asset = await getOwnedAsset(assetId, req.userId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  res.json(asset);
});

router.patch("/assets/:assetId", requireAuth(), async (req, res) => {
  const { assetId } = UpdateAssetParams.parse(req.params);
  const body = UpdateAssetBody.parse(req.body);

  const existing = await getOwnedAsset(assetId, req.userId);
  if (!existing) return res.status(404).json({ error: "Asset not found" });

  const setValues: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if ("retiredAt" in body) {
    setValues.retiredAt = body.retiredAt ?? null;
  }

  const [asset] = await db
    .update(assetsTable)
    .set(setValues)
    .where(eq(assetsTable.id, assetId))
    .returning();
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  res.json(asset);
});

router.delete("/assets/:assetId", requireAuth(), async (req, res) => {
  const { assetId } = DeleteAssetParams.parse(req.params);
  const existing = await getOwnedAsset(assetId, req.userId);
  if (!existing) return res.status(404).json({ error: "Asset not found" });
  await db.delete(assetsTable).where(eq(assetsTable.id, assetId));
  res.status(204).send();
});

export default router;
