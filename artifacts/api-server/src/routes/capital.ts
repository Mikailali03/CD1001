import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db";
import { eq, and, ne, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty } from "../lib/access.js";
import { requireTier } from "../lib/subscription.js";
import { buildCapitalOutlook } from "../lib/capitalOutlook.js";

const router = Router();

const CapitalOutlookParams = z.object({ propertyId: z.string() });

router.get("/properties/:propertyId/capital-outlook", requireAuth(), requireTier("basic"), async (req, res) => {
  const { propertyId } = CapitalOutlookParams.parse(req.params);

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const assets = await db
    .select()
    .from(assetsTable)
    .where(and(
      eq(assetsTable.propertyId, propertyId),
      ne(assetsTable.category, "Structural"),
      isNull(assetsTable.retiredAt),
    ))
    .orderBy(assetsTable.category);

  res.json(buildCapitalOutlook(assets, { state: property.state }));
});

export default router;
