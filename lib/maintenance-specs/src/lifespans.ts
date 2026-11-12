/**
 * Expected service life and typical replacement cost of home equipment — the
 * one table behind the health score, Capital Outlook, and the web and mobile
 * life bars. Each entry cites its source (see ./sources).
 *
 * Lifespans are a value inside the published range for that component. Costs
 * are national-average installed costs in COST_BASE_YEAR dollars; see
 * estimateReplacementCost for the regional and inflation adjustment.
 *
 * Category entries are the fallback for assets whose name doesn't match a more
 * specific type, so they reflect the typical tracked item in each category
 * (e.g. a generic "Plumbing" asset is usually a water heater, pump or softener,
 * not the pipes themselves).
 */
import type { SourceId } from "./sources";
import { climateLifespanFactor, regionCostFactor } from "./regions";

export type EquipmentType = {
  id: string;
  /** Category the type belongs to; used for regional lifespan factors. */
  category: string;
  lifespanYears: number;
  lifespanSource: SourceId;
  /** Installed cost in COST_BASE_YEAR USD, or null where an estimate would mislead. */
  baseCost: number | null;
  costSource: SourceId;
};

type NameRule = EquipmentType & { matches: (lowerName: string, category: string) => boolean };

/** Checked in order; the first match wins (so "dishwasher" is tested before "washer"). */
const NAME_RULES: NameRule[] = [
  { id: "water_heater", category: "Plumbing", lifespanYears: 12, lifespanSource: "NAHB_2007", baseCost: 1800, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("water heater") },
  { id: "furnace", category: "HVAC", lifespanYears: 20, lifespanSource: "NAHB_2007", baseCost: 5000, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("furnace") },
  { id: "central_ac", category: "HVAC", lifespanYears: 15, lifespanSource: "NAHB_2007", baseCost: 6500, costSource: "CASA_ESTIMATE",
    matches: (n) => /\bac\b|\ba\/c\b|air condition/.test(n) },
  { id: "heat_pump", category: "HVAC", lifespanYears: 15, lifespanSource: "NAHB_2007", baseCost: 8000, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("heat pump") },
  { id: "electrical_panel", category: "Electrical", lifespanYears: 40, lifespanSource: "INTERNACHI_LIFE", baseCost: 2500, costSource: "CASA_ESTIMATE",
    matches: (n, c) => n.includes("panel") && c === "Electrical" },
  { id: "wiring", category: "Electrical", lifespanYears: 50, lifespanSource: "NAHB_2007", baseCost: null, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("wiring") },
  { id: "asphalt_roof", category: "Roof", lifespanYears: 22, lifespanSource: "NAHB_2007", baseCost: 12000, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("asphalt") || n.includes("shingle") },
  { id: "metal_roof", category: "Roof", lifespanYears: 50, lifespanSource: "INTERNACHI_LIFE", baseCost: 25000, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("metal roof") },
  { id: "tile_roof", category: "Roof", lifespanYears: 40, lifespanSource: "INTERNACHI_LIFE", baseCost: 25000, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("tile roof") },
  { id: "dishwasher", category: "Appliance", lifespanYears: 12, lifespanSource: "INTERNACHI_LIFE", baseCost: 900, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("dishwasher") },
  { id: "refrigerator", category: "Appliance", lifespanYears: 14, lifespanSource: "NAHB_2007", baseCost: 1800, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("refrigerator") || n.includes("fridge") },
  { id: "laundry", category: "Appliance", lifespanYears: 11, lifespanSource: "NAHB_2007", baseCost: 900, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("washer") || n.includes("dryer") },
  { id: "range", category: "Appliance", lifespanYears: 15, lifespanSource: "NAHB_2007", baseCost: 1500, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("oven") || n.includes("range") },
  { id: "microwave", category: "Appliance", lifespanYears: 9, lifespanSource: "NAHB_2007", baseCost: 400, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("microwave") },
  { id: "foundation", category: "Structural", lifespanYears: 100, lifespanSource: "NAHB_2007", baseCost: null, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("foundation") },
  { id: "sump_pump", category: "Plumbing", lifespanYears: 10, lifespanSource: "INTERNACHI_LIFE", baseCost: 1000, costSource: "CASA_ESTIMATE",
    matches: (n) => n.includes("sump pump") },
];

/** Category fallbacks. Structural and Other have no cost: they're too varied to estimate. */
export const CATEGORY_EQUIPMENT: Record<string, EquipmentType> = {
  HVAC: { id: "hvac", category: "HVAC", lifespanYears: 15, lifespanSource: "NAHB_2007", baseCost: 7000, costSource: "CASA_ESTIMATE" },
  Plumbing: { id: "plumbing", category: "Plumbing", lifespanYears: 12, lifespanSource: "INTERNACHI_LIFE", baseCost: 1500, costSource: "CASA_ESTIMATE" },
  Electrical: { id: "electrical", category: "Electrical", lifespanYears: 25, lifespanSource: "INTERNACHI_LIFE", baseCost: 2000, costSource: "CASA_ESTIMATE" },
  Roof: { id: "roof", category: "Roof", lifespanYears: 22, lifespanSource: "NAHB_2007", baseCost: 12000, costSource: "CASA_ESTIMATE" },
  Appliance: { id: "appliance", category: "Appliance", lifespanYears: 12, lifespanSource: "NAHB_2007", baseCost: 1200, costSource: "CASA_ESTIMATE" },
  Structural: { id: "structural", category: "Structural", lifespanYears: 50, lifespanSource: "NAHB_2007", baseCost: null, costSource: "CASA_ESTIMATE" },
  Other: { id: "other", category: "Other", lifespanYears: 15, lifespanSource: "INTERNACHI_LIFE", baseCost: null, costSource: "CASA_ESTIMATE" },
};

/** Lifespan per category, before regional adjustment. */
export const CATEGORY_LIFESPAN_YEARS: Record<string, number> = Object.fromEntries(
  Object.entries(CATEGORY_EQUIPMENT).map(([k, v]) => [k, v.lifespanYears]),
);

/** The equipment type for an asset: a name match if there is one, else its category. */
export function getEquipmentType(category: string, name: string): EquipmentType {
  const lower = (name ?? "").toLowerCase();
  const rule = NAME_RULES.find((r) => r.matches(lower, category));
  if (rule) {
    const { matches: _m, ...type } = rule;
    return type;
  }
  return CATEGORY_EQUIPMENT[category] ?? CATEGORY_EQUIPMENT.Other!;
}

export type LifespanInfo = {
  years: number;
  baseYears: number;
  regionFactor: number;
  source: SourceId;
};

/** Lifespan for a specific asset, with the regional climate adjustment for its state. */
export function getLifespanInfo(category: string, name: string, state?: string | null): LifespanInfo {
  const type = getEquipmentType(category, name);
  const regionFactor = climateLifespanFactor(type.category, state);
  return {
    years: Math.round(type.lifespanYears * regionFactor),
    baseYears: type.lifespanYears,
    regionFactor,
    source: type.lifespanSource,
  };
}

/** Expected lifespan in whole years. Pass the property's state to apply the climate adjustment. */
export function getExpectedLifespan(category: string, name: string, state?: string | null): number {
  return getLifespanInfo(category, name, state).years;
}

/** Year the base costs are expressed in. */
export const COST_BASE_YEAR = 2024;
/** Annual escalation applied to base costs (roughly long-run U.S. construction cost inflation). */
export const ANNUAL_COST_INFLATION = 0.035;

/**
 * Estimated replacement cost in today's dollars for an asset with no
 * user-entered cost: base cost × regional factor × inflation since
 * COST_BASE_YEAR, rounded to the nearest $50. Null when the category is too
 * varied to estimate (structural, other, wiring, foundation).
 */
export function estimateReplacementCost(
  category: string,
  name: string,
  state?: string | null,
  now: Date = new Date(),
): number | null {
  const type = getEquipmentType(category, name);
  if (type.baseCost == null) return null;
  const years = Math.max(0, now.getFullYear() - COST_BASE_YEAR);
  const raw = type.baseCost * regionCostFactor(state) * Math.pow(1 + ANNUAL_COST_INFLATION, years);
  return Math.round(raw / 50) * 50;
}

/** The user's cost if they entered one, otherwise the estimate, flagged as such. */
export function resolveReplacementCost(
  asset: { category: string; name: string; replacementCost?: string | number | null },
  state?: string | null,
  now: Date = new Date(),
): { cost: number | null; isEstimate: boolean } {
  if (asset.replacementCost != null && asset.replacementCost !== "") {
    const entered = Number(asset.replacementCost);
    if (Number.isFinite(entered)) return { cost: entered, isEstimate: false };
  }
  const estimate = estimateReplacementCost(asset.category, asset.name, state, now);
  return { cost: estimate, isEstimate: estimate != null };
}
