// Starter assets: a checklist of common systems and appliances offered when a
// home is set up, so the dossier isn't empty after onboarding. The suggestion
// logic is shared with the apps (@workspace/maintenance-specs).
import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import {
  AddStarterAssetsBody,
  AddStarterAssetsParams,
  GetStarterAssetsParams,
  GetStarterAssetsQueryParams,
} from "@workspace/api-zod";
import {
  inferHomeType,
  suggestStarterAssets,
  STARTER_ASSET_NOTE,
  type HomeType,
} from "@workspace/maintenance-specs";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty } from "../lib/access.js";
import { recordAudit } from "../lib/audit.js";

const router = Router();

async function suggestionsFor(property: { id: string; address: string; yearBuilt: number | null }, homeType?: HomeType) {
  const existing = await db
    .select({ name: assetsTable.name, category: assetsTable.category })
    .from(assetsTable)
    .where(and(eq(assetsTable.propertyId, property.id), isNull(assetsTable.retiredAt)));
  const resolvedType = homeType ?? inferHomeType(property.address);
  return {
    homeType: resolvedType,
    yearBuilt: property.yearBuilt ?? null,
    suggestions: suggestStarterAssets({ yearBuilt: property.yearBuilt, homeType: resolvedType, existing }),
  };
}

router.get("/properties/:propertyId/starter-assets", requireAuth(), async (req, res) => {
  const { propertyId } = GetStarterAssetsParams.parse(req.params);
  const { homeType } = GetStarterAssetsQueryParams.parse(req.query);
  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json(await suggestionsFor(property, homeType));
});

router.post("/properties/:propertyId/starter-assets", requireAuth(), async (req, res) => {
  const { propertyId } = AddStarterAssetsParams.parse(req.params);
  const body = AddStarterAssetsBody.parse(req.body);
  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  // Recompute rather than trust the client: only keys still suggested for this
  // home are created, so a repeat tap can't add duplicates.
  const { suggestions } = await suggestionsFor(property, body.homeType);
  const wanted = new Set(body.keys);
  const chosen = suggestions.filter((s) => wanted.has(s.key));
  if (chosen.length === 0) {
    res.status(201).json([]);
    return;
  }

  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(assetsTable)
      .values(chosen.map((s) => ({
        propertyId,
        name: s.name,
        category: s.category,
        installDate: s.estimatedInstallYear != null ? `${s.estimatedInstallYear}-01-01` : null,
        status: "unverified" as const,
        notes: s.reason ? `${STARTER_ASSET_NOTE} ${s.reason}` : STARTER_ASSET_NOTE,
      })))
      .returning();
    for (const asset of rows) {
      await recordAudit({
        actorUserId: req.userId,
        action: "asset.created",
        entityType: "asset",
        entityId: asset.id,
        propertyId,
        details: { source: "starter_assets", name: asset.name, installDateEstimated: asset.installDate != null },
      }, tx);
    }
    return rows;
  });

  res.status(201).json(created);
});

export default router;
