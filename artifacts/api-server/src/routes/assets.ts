import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
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
import { z } from "zod/v4";

const router = Router();

router.get("/properties/:propertyId/assets", async (req, res) => {
  const { propertyId } = ListAssetsParams.parse(req.params);
  const query = ListAssetsQueryParams.parse(req.query);
  const includeRetired = req.query.includeRetired === "true";

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

router.post("/properties/:propertyId/assets", async (req, res) => {
  const { propertyId } = CreateAssetParams.parse(req.params);
  const body = CreateAssetBody.parse(req.body);
  const [asset] = await db.insert(assetsTable).values({ ...body, propertyId }).returning();
  res.status(201).json(asset);
});

router.get("/assets/:assetId", async (req, res) => {
  const { assetId } = GetAssetParams.parse(req.params);
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, assetId));
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  res.json(asset);
});

router.patch("/assets/:assetId", async (req, res) => {
  const { assetId } = UpdateAssetParams.parse(req.params);
  const body = UpdateAssetBody.parse(req.body);

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

router.delete("/assets/:assetId", async (req, res) => {
  const { assetId } = DeleteAssetParams.parse(req.params);
  await db.delete(assetsTable).where(eq(assetsTable.id, assetId));
  res.status(204).send();
});

export default router;
