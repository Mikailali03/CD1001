/**
 * Regional adjustments, keyed by the property's US state.
 *
 * - Climate region → lifespan multiplier per category. Hot climates run HVAC
 *   longer each year and bake roofs with UV; cold climates add freeze–thaw and
 *   ice dams; the hard water common in the Southwest shortens water heaters.
 *   The multipliers are deliberately modest (±5–15%) and are planning
 *   adjustments, not engineering figures.
 * - Cost region → multiplier on national-average installed costs, broadly in
 *   line with published regional construction cost indexes.
 *
 * Unknown or missing states get 1.0 for everything.
 */

export type ClimateRegion = "hot_humid" | "hot_dry" | "mixed" | "cold" | "marine";
export type CostRegion = "northeast" | "midwest" | "south" | "mountain" | "pacific" | "alaska_hawaii";

const STATE_CLIMATE: Record<string, ClimateRegion> = {
  FL: "hot_humid", LA: "hot_humid", MS: "hot_humid", AL: "hot_humid", GA: "hot_humid",
  SC: "hot_humid", TX: "hot_humid", HI: "hot_humid", PR: "hot_humid",
  AZ: "hot_dry", NV: "hot_dry", NM: "hot_dry",
  MN: "cold", WI: "cold", MI: "cold", ND: "cold", SD: "cold", ME: "cold", VT: "cold",
  NH: "cold", MT: "cold", WY: "cold", AK: "cold", IA: "cold", NY: "cold", MA: "cold",
  ID: "cold", CO: "cold", UT: "cold",
  WA: "marine", OR: "marine",
  // Everything else (mid-Atlantic, lower Midwest, upper South, CA) is "mixed".
};

/** Lifespan multiplier per category for each climate region. Missing = 1.0. */
export const CLIMATE_LIFESPAN_FACTORS: Record<ClimateRegion, Partial<Record<string, number>>> = {
  hot_humid: { HVAC: 0.85, Roof: 0.85, Structural: 0.95 },
  hot_dry: { HVAC: 0.85, Roof: 0.9, Plumbing: 0.9 },
  mixed: {},
  cold: { HVAC: 0.95, Roof: 0.9, Structural: 0.95 },
  marine: { Roof: 0.9 },
};

const STATE_COST: Record<string, CostRegion> = {
  CT: "northeast", ME: "northeast", MA: "northeast", NH: "northeast", RI: "northeast",
  VT: "northeast", NJ: "northeast", NY: "northeast", PA: "northeast", DE: "northeast",
  MD: "northeast", DC: "northeast",
  IL: "midwest", IN: "midwest", MI: "midwest", OH: "midwest", WI: "midwest", IA: "midwest",
  KS: "midwest", MN: "midwest", MO: "midwest", NE: "midwest", ND: "midwest", SD: "midwest",
  AL: "south", AR: "south", FL: "south", GA: "south", KY: "south", LA: "south", MS: "south",
  NC: "south", OK: "south", SC: "south", TN: "south", TX: "south", VA: "south", WV: "south",
  PR: "south",
  AZ: "mountain", CO: "mountain", ID: "mountain", MT: "mountain", NV: "mountain",
  NM: "mountain", UT: "mountain", WY: "mountain",
  CA: "pacific", OR: "pacific", WA: "pacific",
  AK: "alaska_hawaii", HI: "alaska_hawaii",
};

/** Multiplier on national-average installed cost. */
export const REGION_COST_FACTORS: Record<CostRegion, number> = {
  northeast: 1.15,
  midwest: 0.95,
  south: 0.9,
  mountain: 1.0,
  pacific: 1.2,
  alaska_hawaii: 1.3,
};

const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "puerto rico": "PR",
};

/** "GA", "ga", "Georgia" → "GA". Null if it isn't a recognisable state. */
export function normalizeState(state: string | null | undefined): string | null {
  if (!state) return null;
  const s = state.trim();
  if (s.length === 2) return s.toUpperCase();
  return STATE_NAMES[s.toLowerCase()] ?? null;
}

export function climateRegionForState(state: string | null | undefined): ClimateRegion {
  const code = normalizeState(state);
  return (code && STATE_CLIMATE[code]) || "mixed";
}

export function costRegionForState(state: string | null | undefined): CostRegion | null {
  const code = normalizeState(state);
  return (code && STATE_COST[code]) || null;
}

export function climateLifespanFactor(category: string, state: string | null | undefined): number {
  return CLIMATE_LIFESPAN_FACTORS[climateRegionForState(state)][category] ?? 1;
}

export function regionCostFactor(state: string | null | undefined): number {
  const region = costRegionForState(state);
  return region ? REGION_COST_FACTORS[region] : 1;
}
