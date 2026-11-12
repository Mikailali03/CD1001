import { z } from "zod";

// AI Lens label scans: the model's reply is untrusted. Validate it against the
// AssetScanResult shape and drop anything that doesn't fit, instead of passing
// whatever came back straight to the client.

const CATEGORIES = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"] as const;

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, max))
    .nullable()
    .catch(null);

/** "2019-03", "2019-3", "2019-03-14", "03/2019" → "2019-03". Anything else → null. */
const yearMonth = z
  .string()
  .trim()
  .transform((s, ctx) => {
    let m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s);
    let year: number, month: number;
    if (m) {
      year = Number(m[1]);
      month = Number(m[2]);
    } else if ((m = /^(\d{1,2})\/(\d{4})$/.exec(s))) {
      year = Number(m[2]);
      month = Number(m[1]);
    } else {
      ctx.addIssue({ code: "custom", message: "not a year-month" });
      return z.NEVER;
    }
    const thisYear = new Date().getFullYear();
    if (month < 1 || month > 12 || year < 1900 || year > thisYear + 1) {
      ctx.addIssue({ code: "custom", message: "out of range" });
      return z.NEVER;
    }
    return `${year}-${String(month).padStart(2, "0")}`;
  })
  .nullable()
  .catch(null);

export const AssetScanResultSchema = z.object({
  brand: text(80),
  model: text(80),
  serialNumber: text(80),
  manufactureDate: yearMonth,
  estimatedReplacementCost: z.coerce.number().positive().max(500_000).transform(Math.round).nullable().catch(null),
  category: z.enum(CATEGORIES).nullable().catch(null),
  suggestedName: text(80),
});

export type AssetScanResult = z.infer<typeof AssetScanResultSchema>;

/**
 * Parse a model reply that should be one JSON object describing a label.
 * Returns null if it isn't a JSON object or nothing usable was read from it.
 */
export function parseAssetScan(raw: string): AssetScanResult | null {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  // Missing keys become null rather than failing the whole scan.
  const withDefaults = Object.fromEntries(
    Object.keys(AssetScanResultSchema.shape).map((k) => [k, (parsed as Record<string, unknown>)[k] ?? null]),
  );
  const result = AssetScanResultSchema.safeParse(withDefaults);
  if (!result.success) return null;
  const read = result.data;
  if (Object.values(read).every((v) => v == null)) return null;
  return read;
}
