import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { propertiesTable, assetsTable, maintenanceTasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedProperty } from "../lib/access.js";

const router = Router();

const LookupQuery = z.object({ address: z.string().min(5) });

router.get("/properties/lookup", requireAuth(), async (req, res) => {
  const { address } = LookupQuery.parse(req.query);

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "RentCast API key not configured" });

  const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
  });

  if (!response.ok) {
    const text = await response.text();
    req.log.warn({ status: response.status, body: text }, "RentCast lookup failed");
    return res.status(response.status).json({ error: "Property lookup failed", detail: text });
  }

  const data = await response.json() as any[];
  if (!data || data.length === 0) {
    return res.status(404).json({ error: "No property found for that address" });
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
  });
});

const ScoutParams = z.object({ propertyId: z.string() });

router.post("/properties/:propertyId/scout", requireAuth(), async (req, res) => {
  const { propertyId } = ScoutParams.parse(req.params);

  const property = await getOwnedProperty(propertyId, req.userId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const homeAge = property.yearBuilt ? new Date().getFullYear() - property.yearBuilt : null;
  const prompt = `You are a home maintenance expert generating a "Whole-Home Stewardship Plan" for a homeowner.

Property details:
- Address: ${property.address}, ${property.city ?? ""}, ${property.state ?? ""}
- Year Built: ${property.yearBuilt ?? "unknown"} (${homeAge != null ? `~${homeAge} years old` : "age unknown"})
- Size: ${property.sqft ? `${property.sqft.toLocaleString()} sq ft` : "unknown size"}
- Bedrooms: ${property.bedrooms ?? "unknown"}, Bathrooms: ${property.bathrooms ?? "unknown"}

Generate 8–12 recurring home maintenance tasks appropriate for this property's age, climate region (inferred from state/location), and size. Focus on tasks a homeowner can realistically do themselves (DIY). Include some professional tasks too.

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

  let tasks: any[];
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    tasks = JSON.parse(cleaned);
  } catch {
    req.log.error({ raw }, "Failed to parse AI scout response");
    return res.status(500).json({ error: "AI response could not be parsed", raw });
  }

  let [stewardshipAsset] = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.propertyId, propertyId))
    .then((rows) => rows.filter((r) => r.category === "Structural" && r.name === "Home Stewardship"));

  if (!stewardshipAsset) {
    [stewardshipAsset] = await db
      .insert(assetsTable)
      .values({
        propertyId,
        name: "Home Stewardship",
        category: "Structural",
        status: "verified",
        description: "General home-wide maintenance tasks not tied to a specific appliance or system.",
      })
      .returning();
  }

  const today = new Date();
  const insertedTasks = await Promise.all(
    tasks
      .filter((t) => t.title && typeof t.intervalDays === "number")
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
