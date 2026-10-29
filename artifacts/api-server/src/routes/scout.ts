import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { propertiesTable, assetsTable, maintenanceTasksTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAccessibleProperty } from "../lib/access.js";
import { aiRateLimit } from "../lib/subscription.js";
import { parseAiTasks } from "../lib/aiTasks.js";

const router = Router();

// ---------------------------------------------------------------------------
// Address autocomplete  (debounced as-you-type suggestions)
// ---------------------------------------------------------------------------

const AutocompleteQuery = z.object({
  query: z.string().min(3),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

router.get("/properties/autocomplete", requireAuth(), async (req, res) => {
  const parsed = AutocompleteQuery.safeParse(req.query);
  if (!parsed.success) {
    res.json({ suggestions: [] });
    return;
  }
  const { query, limit } = parsed.data;

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    req.log.warn("RentCast API key not configured — autocomplete unavailable");
    res.json({ suggestions: [] });
    return;
  }

  try {
    const url = `https://api.rentcast.io/v1/autocomplete?address=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });

    if (!response.ok) {
      req.log.warn({ status: response.status }, "RentCast autocomplete failed — degrading gracefully");
      res.json({ suggestions: [] });
      return;
    }

    const data = await response.json() as any[];
    const suggestions = (Array.isArray(data) ? data : [])
      .map((item: any) => ({
        address: item.formattedAddress ?? item.addressLine1 ?? "",
        city: item.city ?? null,
        state: item.state ?? null,
        zipCode: item.zipCode ?? null,
      }))
      .filter((s) => s.address);

    res.json({ suggestions });
    return;
  } catch (err) {
    req.log.warn({ err }, "RentCast autocomplete error — degrading gracefully");
    res.json({ suggestions: [] });
    return;
  }
});

// ---------------------------------------------------------------------------
// Full property lookup
// ---------------------------------------------------------------------------

const LookupQuery = z.object({ address: z.string().min(5) });

router.get("/properties/lookup", requireAuth(), async (req, res) => {
  const { address } = LookupQuery.parse(req.query);

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "RentCast API key not configured" });
    return;
  }

  const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
  });

  if (!response.ok) {
    const text = await response.text();
    req.log.warn({ status: response.status, body: text }, "RentCast lookup failed");
    res.status(response.status).json({ error: "Property lookup failed", detail: text });
    return;
  }

  const data = await response.json() as any[];
  if (!data || data.length === 0) {
    res.status(404).json({ error: "No property found for that address" });
    return;
  }

  const p = data[0];
  res.json({
    address: p.addressLine1 ?? address,
    city: p.city ?? null,
    state: p.state ?? null,
    zipCode: p.zipCode ?? null,
    yearBuilt: p.yearBuilt ?? null,
    sqft: p.squareFootage ?? null,
    bedrooms: p.bedrooms ?? null,
    bathrooms: p.bathrooms ?? null,
    lotSize: p.lotSize ?? null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  });
});

const ScoutParams = z.object({ propertyId: z.string() });

router.post("/properties/:propertyId/scout", requireAuth(), aiRateLimit(), async (req, res) => {
  const { propertyId } = ScoutParams.parse(req.params);

  const property = await getAccessibleProperty(propertyId, req.userId);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  // One stewardship plan per property: if it already exists, return it rather
  // than paying for another AI call and piling duplicate tasks onto the asset.
  const [existingPlan] = await db
    .select()
    .from(assetsTable)
    .where(
      and(
        eq(assetsTable.propertyId, propertyId),
        eq(assetsTable.category, "Structural"),
        eq(assetsTable.name, "Home Stewardship"),
      ),
    )
    .limit(1);
  if (existingPlan) {
    const existingTasks = await db
      .select()
      .from(maintenanceTasksTable)
      .where(eq(maintenanceTasksTable.assetId, existingPlan.id));
    if (existingTasks.length > 0) {
      res.json({ asset: existingPlan, tasks: existingTasks, taskCount: existingTasks.length });
      return;
    }
  }

  const homeAge = property.yearBuilt ? new Date().getFullYear() - property.yearBuilt : null;

  // Fetch existing named assets so the AI knows what NOT to duplicate
  const existingAssets = await db
    .select({ name: assetsTable.name, category: assetsTable.category })
    .from(assetsTable)
    .where(eq(assetsTable.propertyId, propertyId))
    .then((rows) => rows.filter((r) => r.name !== "Home Stewardship"));

  const assetList = existingAssets.length > 0
    ? existingAssets.map((a) => `- ${a.name} (${a.category})`).join("\n")
    : "None recorded yet";

  const prompt = `You are a home maintenance expert generating a "Whole-Home Stewardship Plan" for a homeowner.

Property details:
- Address: ${property.address}, ${property.city ?? ""}, ${property.state ?? ""}
- Year Built: ${property.yearBuilt ?? "unknown"} (${homeAge != null ? `~${homeAge} years old` : "age unknown"})
- Size: ${property.sqft ? `${property.sqft.toLocaleString()} sq ft` : "unknown size"}
- Bedrooms: ${property.bedrooms ?? "unknown"}, Bathrooms: ${property.bathrooms ?? "unknown"}

This homeowner already has the following appliances and systems tracked as individual assets:
${assetList}

YOUR TASK: Generate 8–12 recurring maintenance tasks for the Home Stewardship asset. This asset covers ONLY whole-home safety and structural items that do NOT belong to any specific appliance or system.

STRICT RULES:
1. Do NOT generate tasks for any asset listed above. Each of those assets manages its own maintenance schedule. Generating tasks like "HVAC filter replacement", "water heater flushing", "furnace tune-up", "refrigerator coil cleaning", or anything tied to a named appliance or system causes duplication and must be avoided.
2. ONLY include tasks for items that don't have a dedicated asset record — things like:
   - Smoke and carbon monoxide detector testing and battery replacement
   - Foundation and basement inspection
   - Pest and termite inspection
   - Gutter cleaning and downspout flushing
   - Dryer vent cleaning (the vent duct, not the appliance)
   - Exterior caulking and weatherstripping
   - Roof and attic visual inspection
   - Window and door seals
   - Chimney and fireplace inspection (if applicable to age/region)
   - Exterior grading and drainage check
   - Driveway and walkway inspection
   - Exterior paint and siding condition check
3. Tailor frequency and urgency to the property's age and climate region (inferred from state).
4. Include a mix of DIY and professional tasks.

Respond ONLY with a JSON array. No markdown, no explanation, just the array. Each object must have exactly these fields:
{
  "title": string,           // short task name, max 60 chars
  "description": string,    // 1-2 sentence explanation of why it matters and how to do it
  "intervalDays": number,   // recurrence in days (30, 90, 180, or 365)
  "isDiy": boolean,         // true if a homeowner can reasonably do this themselves
  "estimatedCost": number | null  // estimated cost in USD, null if DIY with no materials
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content ?? "[]";

  const tasks = parseAiTasks(raw);
  if (!tasks) {
    req.log.error({ raw }, "Failed to parse AI scout response");
    res.status(502).json({ error: "Couldn't generate a plan right now. Please try again." });
    return;
  }

  let stewardshipAsset = existingPlan;
  if (!stewardshipAsset) {
    [stewardshipAsset] = await db
      .insert(assetsTable)
      .values({
        propertyId,
        name: "Home Stewardship",
        category: "Structural",
        status: "verified",
        notes: "General home-wide maintenance tasks not tied to a specific appliance or system.",
      })
      .returning();
  }

  const today = new Date();
  const insertedTasks = await Promise.all(
    tasks
      .map((t) => {
        const due = new Date(today);
        due.setDate(due.getDate() + Math.min(t.intervalDays, 90));
        const nextDueDate = due.toISOString().split("T")[0]!;
        return db
          .insert(maintenanceTasksTable)
          .values({
            assetId: stewardshipAsset!.id,
            title: t.title,
            description: t.description,
            intervalDays: t.intervalDays,
            nextDueDate,
            isDiy: t.isDiy ?? true,
            estimatedCost: t.estimatedCost != null ? String(t.estimatedCost) : null,
          })
          .returning()
          .then((rows) => rows[0]!);
      })
  );

  res.json({
    asset: stewardshipAsset,
    tasks: insertedTasks,
    taskCount: insertedTasks.length,
  });
});

export default router;
