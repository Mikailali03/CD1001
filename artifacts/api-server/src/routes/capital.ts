import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty } from "../lib/access.js";

const router = Router();

const BASE_LIFESPAN: Record<string, number> = {
  HVAC: 17,
  Plumbing: 12,
  Electrical: 40,
  Roof: 22,
  Appliance: 12,
  Structural: 50,
  Other: 15,
};

function getExpectedLifespan(category: string, name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("water heater")) return 12;
  if (lower.includes("furnace")) return 20;
  if (lower.includes("ac") || lower.includes("air condition")) return 15;
  if (lower.includes("heat pump")) return 15;
  if (lower.includes("panel") && category === "Electrical") return 40;
  if (lower.includes("wiring")) return 50;
  if (lower.includes("asphalt") || lower.includes("shingle")) return 22;
  if (lower.includes("metal roof")) return 50;
  if (lower.includes("tile roof")) return 40;
  if (lower.includes("dishwasher")) return 12;
  if (lower.includes("refrigerator") || lower.includes("fridge")) return 14;
  if (lower.includes("washer") || lower.includes("dryer")) return 11;
  if (lower.includes("oven") || lower.includes("range")) return 15;
  if (lower.includes("microwave")) return 9;
  if (lower.includes("foundation")) return 100;
  if (lower.includes("sump pump")) return 10;
  return BASE_LIFESPAN[category] ?? 15;
}

type Urgency = "critical" | "warning" | "good" | "unknown";

function getUrgency(yearsRemaining: number | null): Urgency {
  if (yearsRemaining == null) return "unknown";
  if (yearsRemaining <= 3) return "critical";
  if (yearsRemaining <= 8) return "warning";
  return "good";
}

const CapitalOutlookParams = z.object({ propertyId: z.string() });

router.get("/properties/:propertyId/capital-outlook", requireAuth(), async (req, res) => {
  const { propertyId } = CapitalOutlookParams.parse(req.params);

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const assets = await db
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.propertyId, propertyId), ne(assetsTable.category, "Structural")))
    .orderBy(assetsTable.category);

  const currentYear = new Date().getFullYear();

  const enriched = assets.map((asset) => {
    const lifespan = getExpectedLifespan(asset.category, asset.name);
    const installYear = asset.installDate ? new Date(asset.installDate).getFullYear() : null;
    const replacementYear = installYear != null ? installYear + lifespan : null;
    const yearsRemaining = replacementYear != null ? replacementYear - currentYear : null;
    const ageYears = installYear != null ? currentYear - installYear : null;
    const percentLifeUsed = ageYears != null ? Math.min(100, Math.round((ageYears / lifespan) * 100)) : null;
    const cost = asset.replacementCost != null ? Number(asset.replacementCost) : null;

    return {
      id: asset.id,
      name: asset.name,
      category: asset.category,
      brand: asset.brand,
      model: asset.model,
      installDate: asset.installDate,
      installYear,
      replacementCost: cost,
      expectedLifespanYears: lifespan,
      replacementYear,
      yearsRemaining,
      urgency: getUrgency(yearsRemaining),
      ageYears,
      percentLifeUsed,
    };
  });

  const totalTrackedValue = enriched.reduce((sum, a) => sum + (a.replacementCost ?? 0), 0);

  const timelineMap = new Map<number, { projectedCost: number; assetNames: string[] }>();
  for (let y = currentYear; y <= currentYear + 20; y++) {
    timelineMap.set(y, { projectedCost: 0, assetNames: [] });
  }

  for (const asset of enriched) {
    if (asset.replacementYear != null && asset.replacementCost != null) {
      const yr = asset.replacementYear;
      if (yr >= currentYear && yr <= currentYear + 20) {
        const entry = timelineMap.get(yr)!;
        entry.projectedCost += asset.replacementCost;
        entry.assetNames.push(asset.name);
      }
    }
  }

  const timeline = Array.from(timelineMap.entries())
    .map(([year, v]) => ({ year, projectedCost: v.projectedCost, assetNames: v.assetNames }))
    .sort((a, b) => a.year - b.year);

  const withDates = enriched.filter((a) => a.replacementYear != null && a.replacementCost != null);
  const upcoming = withDates
    .filter((a) => a.replacementYear! >= currentYear)
    .sort((a, b) => a.replacementYear! - b.replacementYear!);

  const nextReplacement = upcoming[0]
    ? { name: upcoming[0].name, year: upcoming[0].replacementYear!, cost: upcoming[0].replacementCost! }
    : null;

  const next5YearCost = timeline
    .filter((t) => t.year >= currentYear && t.year < currentYear + 5)
    .reduce((s, t) => s + t.projectedCost, 0);

  const next10YearCost = timeline
    .filter((t) => t.year >= currentYear && t.year < currentYear + 10)
    .reduce((s, t) => s + t.projectedCost, 0);

  res.json({
    totalTrackedValue,
    assets: enriched,
    timeline,
    summary: { nextReplacement, next5YearCost, next10YearCost },
  });
});

export default router;
