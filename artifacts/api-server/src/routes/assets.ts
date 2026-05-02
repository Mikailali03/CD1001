import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

const router = Router();

router.get("/properties/:propertyId/assets", async (req, res) => {
  const { propertyId } = ListAssetsParams.parse(req.params);
  const query = ListAssetsQueryParams.parse(req.query);

  const conditions = [eq(assetsTable.propertyId, propertyId)];
  if (query.category) {
    conditions.push(eq(assetsTable.category, query.category));
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
  const [asset] = await db
    .update(assetsTable)
    .set({ ...body, updatedAt: new Date() })
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
