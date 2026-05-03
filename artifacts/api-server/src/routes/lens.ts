import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { assetsTable, maintenanceTasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getOwnedAsset } from "../lib/access.js";

const router = Router();

const ScanBody = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.string().default("image/jpeg"),
});

router.post("/assets/scan", requireAuth(), async (req, res) => {
  const { imageBase64, mimeType } = ScanBody.parse(req.body);

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          } as any,
          {
            type: "text",
            text: `You are an expert at reading appliance, HVAC, and home-system specification plates and labels.

Examine this image and extract the following information. If a field cannot be determined from the image, return null.

Return ONLY a raw JSON object — no markdown fences, no explanation — with these exact fields:
{
  "brand": string | null,
  "model": string | null,
  "serialNumber": string | null,
  "manufactureDate": string | null,
  "estimatedReplacementCost": number | null,
  "category": "HVAC" | "Plumbing" | "Electrical" | "Roof" | "Appliance" | "Structural" | "Other" | null,
  "suggestedName": string | null
}

For "manufactureDate": look for labels such as "MFR DATE", "MANUF DATE", "DATE OF MFR", "MANUFACTURE DATE", "MFG DATE", "DOM", or any date-like value near the unit's serial/model info. Always return in YYYY-MM format (month and year only — do not include the day).
For "estimatedReplacementCost": provide your best estimate in USD based on brand/model/type — even if not printed on the label.
For "suggestedName": a short plain-English name like "Carrier Central AC Unit" or "Rheem Water Heater".`,
          },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    const extracted = JSON.parse(cleaned);
    res.json(extracted);
  } catch {
    req.log.error({ raw }, "AI Lens: failed to parse OCR response");
    res.status(500).json({ error: "Could not parse AI response", raw });
  }
});

const GenerateTasksParams = z.object({ assetId: z.string() });

router.post("/assets/:assetId/generate-tasks", requireAuth(), async (req, res) => {
  const { assetId } = GenerateTasksParams.parse(req.params);

  const asset = await getOwnedAsset(assetId, req.userId);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const ageYears = asset.installDate
    ? Math.floor((Date.now() - new Date(asset.installDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const prompt = `You are a certified home maintenance expert and the official maintenance advisor for ${asset.brand ?? "this brand"}.

Generate the complete manufacturer-recommended maintenance schedule for this specific asset.

Asset Details:
- Name: ${asset.name}
- Category: ${asset.category}
- Brand: ${asset.brand ?? "Unknown"}
- Model: ${asset.model ?? "Unknown"}
- Serial: ${asset.serialNumber ?? "Unknown"}
${ageYears != null ? `- Age: ~${ageYears} year${ageYears !== 1 ? "s" : ""}` : ""}

Generate 6–10 maintenance tasks specific to this brand/model. Prioritize tasks more frequently for older units.

Return ONLY a raw JSON array — no markdown, no explanation. Each object must have exactly:
{
  "title": string,
  "description": string,
  "howTo": string,
  "intervalDays": number,
  "isDiy": boolean,
  "estimatedCost": number | null
}

Field rules:
- "title": short action-oriented name, max 60 chars (e.g., "Replace MERV-11 Air Filter")
- "description": 1-2 sentences explaining WHY this task matters for this specific unit
- "howTo": detailed step-by-step instructions starting with "• " for each bullet. Include safety warnings, tool list, and tips specific to ${asset.brand ?? "this brand"} units. Use \\n between bullets.
- "intervalDays": one of 30, 60, 90, 180, 365
- "isDiy": true if a careful homeowner can do it, false if a licensed tech is required
- "estimatedCost": materials cost in USD (parts/supplies only), or null if no materials needed`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content ?? "[]";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

  let tasks: any[];
  try {
    tasks = JSON.parse(cleaned);
  } catch {
    req.log.error({ raw }, "Autonomous task gen: failed to parse AI response");
    return res.status(500).json({ error: "AI response could not be parsed", raw });
  }

  const today = new Date();
  const inserted = await Promise.all(
    tasks
      .filter((t: any) => t.title && typeof t.intervalDays === "number")
      .map((t: any) => {
        const due = new Date(today);
        due.setDate(due.getDate() + Math.min(t.intervalDays, 90));
        const fullDescription = t.howTo
          ? `${t.description}\n\nHow to do it:\n${t.howTo}`
          : t.description;
        return db
          .insert(maintenanceTasksTable)
          .values({
            assetId,
            title: t.title,
            description: fullDescription,
            intervalDays: t.intervalDays,
            nextDueDate: due.toISOString().split("T")[0]!,
            isDiy: t.isDiy ?? true,
            estimatedCost: t.estimatedCost != null ? String(t.estimatedCost) : null,
          })
          .returning()
          .then((rows) => rows[0]!);
      })
  );

  await db
    .update(assetsTable)
    .set({ status: "verified", updatedAt: new Date() })
    .where(eq(assetsTable.id, assetId));

  res.json({ tasks: inserted, taskCount: inserted.length });
});

export default router;
