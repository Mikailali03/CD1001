import { Router } from "express";
import { db } from "@workspace/db";
import { marketplaceJobsTable, assetsTable, propertiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateMarketplaceJobBody } from "@workspace/api-zod";

const router = Router();

router.get("/marketplace/jobs", async (req, res) => {
  const jobs = await db
    .select({
      id: marketplaceJobsTable.id,
      assetId: marketplaceJobsTable.assetId,
      assetName: assetsTable.name,
      assetCategory: assetsTable.category,
      assetBrand: assetsTable.brand,
      assetModel: assetsTable.model,
      assetSerialNumber: assetsTable.serialNumber,
      description: marketplaceJobsTable.description,
      urgency: marketplaceJobsTable.urgency,
      status: marketplaceJobsTable.status,
      city: propertiesTable.city,
      state: propertiesTable.state,
      createdAt: marketplaceJobsTable.createdAt,
    })
    .from(marketplaceJobsTable)
    .innerJoin(assetsTable, eq(marketplaceJobsTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .orderBy(marketplaceJobsTable.createdAt);

  res.json(jobs);
});

router.post("/marketplace/jobs", async (req, res) => {
  const body = CreateMarketplaceJobBody.parse(req.body);

  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, body.assetId));
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const [job] = await db
    .insert(marketplaceJobsTable)
    .values({ assetId: body.assetId, description: body.description, urgency: body.urgency ?? "medium" })
    .returning();

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, asset.propertyId));

  res.status(201).json({
    ...job,
    assetName: asset.name,
    assetCategory: asset.category,
    assetBrand: asset.brand,
    assetModel: asset.model,
    assetSerialNumber: asset.serialNumber,
    city: property?.city ?? null,
    state: property?.state ?? null,
  });
});

export default router;
