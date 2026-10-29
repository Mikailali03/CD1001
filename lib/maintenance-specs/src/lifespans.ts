/**
 * Expected service life of home equipment, in years. Shared by the server's
 * health score and Capital Outlook and by the web and mobile apps, so every
 * surface agrees on when an asset is worn out.
 *
 * Category values are the fallback for assets whose name doesn't match a more
 * specific type below, so they reflect the typical tracked item in each
 * category (e.g. a generic "Plumbing" asset is usually a water heater, pump or
 * softener, not the pipes themselves).
 */
export const CATEGORY_LIFESPAN_YEARS: Record<string, number> = {
  HVAC: 15,
  Plumbing: 12,
  Electrical: 25,
  Roof: 22,
  Appliance: 12,
  Structural: 50,
  Other: 15,
};

const DEFAULT_LIFESPAN_YEARS = 15;

/** Lifespan for a specific asset, refined by well-known equipment types in its name. */
export function getExpectedLifespan(category: string, name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("water heater")) return 12;
  if (lower.includes("furnace")) return 20;
  if (/\bac\b|\ba\/c\b|air condition/.test(lower)) return 15;
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
  return CATEGORY_LIFESPAN_YEARS[category] ?? DEFAULT_LIFESPAN_YEARS;
}
