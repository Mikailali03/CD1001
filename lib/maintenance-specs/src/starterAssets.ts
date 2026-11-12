/**
 * Starter assets suggested when a home is set up, so the dossier isn't empty
 * after onboarding. Shared by the API (which creates them) and the web and
 * mobile apps, so every surface suggests the same list.
 *
 * Suggestions are a starting point only: install years are estimated from the
 * year the home was built, and the owner is asked to confirm them.
 */
import { getExpectedLifespan } from "./lifespans";

export const HOME_TYPES = ["single_family", "townhouse", "condo"] as const;
export type HomeType = (typeof HOME_TYPES)[number];

type StarterAssetCategory = "HVAC" | "Plumbing" | "Electrical" | "Roof" | "Appliance" | "Other";

/** Age-related reasons an asset is worth checking. The apps translate these by code. */
export const STARTER_ASSET_REASONS = {
  galvanized_pipes:
    "Homes built before 1960 often have galvanized steel pipes, which corrode from the inside. Worth identifying what you have.",
  polybutylene_pipes:
    "Homes built between 1978 and 1995 may have polybutylene pipes, which are prone to sudden failure. Worth identifying what you have.",
  knob_and_tube: "Homes built before 1950 may still have knob-and-tube wiring, which many insurers won't cover.",
  aluminum_wiring:
    "Homes built between 1965 and 1973 sometimes used aluminum branch wiring, a known fire risk at connections.",
} as const;
export type StarterAssetReasonCode = keyof typeof STARTER_ASSET_REASONS;

type StarterAssetDef = {
  key: string;
  name: string;
  category: StarterAssetCategory;
  /** Pre-ticked in the checklist. Others are offered but left unticked. */
  recommended: boolean;
  /** Home types this applies to. Omitted means every type. */
  homeTypes?: readonly HomeType[];
  /** Only suggested when this returns a reason for the home's year built. */
  forYearBuilt?: (yearBuilt: number) => StarterAssetReasonCode | null;
  /** Existing assets whose name matches this (in the same category) count as already tracked. */
  matches: RegExp;
};

const STARTER_ASSETS: readonly StarterAssetDef[] = [
  { key: "hvac", name: "HVAC system", category: "HVAC", recommended: true, matches: /hvac|furnace|air condition|\bac\b|a\/c|heat pump|air handler|mini.?split/i },
  { key: "water_heater", name: "Water heater", category: "Plumbing", recommended: true, matches: /water heater|tankless/i },
  { key: "roof", name: "Roof (asphalt shingle)", category: "Roof", recommended: true, homeTypes: ["single_family", "townhouse"], matches: /roof|shingle/i },
  { key: "electrical_panel", name: "Electrical panel", category: "Electrical", recommended: true, matches: /panel|breaker|load center/i },
  { key: "refrigerator", name: "Refrigerator", category: "Appliance", recommended: true, matches: /refrigerator|fridge/i },
  { key: "dishwasher", name: "Dishwasher", category: "Appliance", recommended: true, matches: /dishwasher/i },
  { key: "range", name: "Range / oven", category: "Appliance", recommended: true, matches: /range|oven|stove|cooktop/i },
  { key: "washer", name: "Clothes washer", category: "Appliance", recommended: false, matches: /\bwasher\b|washing machine/i },
  { key: "dryer", name: "Clothes dryer", category: "Appliance", recommended: false, matches: /dryer/i },
  { key: "garage_door", name: "Garage door opener", category: "Other", recommended: false, homeTypes: ["single_family", "townhouse"], matches: /garage/i },
  {
    key: "supply_plumbing",
    name: "Supply plumbing",
    category: "Plumbing",
    recommended: true,
    matches: /pipe|plumbing|supply line|repipe/i,
    forYearBuilt: (y) => (y < 1960 ? "galvanized_pipes" : y >= 1978 && y <= 1995 ? "polybutylene_pipes" : null),
  },
  {
    key: "wiring",
    name: "Electrical wiring",
    category: "Electrical",
    recommended: true,
    matches: /wiring/i,
    forYearBuilt: (y) => (y < 1950 ? "knob_and_tube" : y >= 1965 && y <= 1973 ? "aluminum_wiring" : null),
  },
];

const STARTER_ASSET_KEYS = new Set(STARTER_ASSETS.map((a) => a.key));

export function isStarterAssetKey(key: string): boolean {
  return STARTER_ASSET_KEYS.has(key);
}

export type StarterAssetSuggestion = {
  key: string;
  name: string;
  category: StarterAssetCategory;
  recommended: boolean;
  /** Why it's suggested for this home in particular (age-related checks). */
  reasonCode: StarterAssetReasonCode | null;
  reason: string | null;
  /**
   * Year built, if the home is younger than the asset's expected life (so the
   * original is likely still in place). Null when it has probably been replaced
   * since, or the year built is unknown: the owner is asked for the date.
   */
  estimatedInstallYear: number | null;
};

/** A unit number in the street address usually means a condo or apartment. */
export function inferHomeType(address: string | null | undefined): HomeType {
  if (address && /(\b(apt|apartment|unit|suite|ste)\b|#)\s*\w/i.test(address)) return "condo";
  return "single_family";
}

export function suggestStarterAssets(input: {
  yearBuilt: number | null | undefined;
  homeType: HomeType;
  existing?: readonly { name: string; category: string }[];
  currentYear?: number;
}): StarterAssetSuggestion[] {
  const currentYear = input.currentYear ?? new Date().getFullYear();
  const yearBuilt = input.yearBuilt && input.yearBuilt > 1600 && input.yearBuilt <= currentYear + 1 ? input.yearBuilt : null;
  const existing = input.existing ?? [];

  const out: StarterAssetSuggestion[] = [];
  for (const def of STARTER_ASSETS) {
    if (def.homeTypes && !def.homeTypes.includes(input.homeType)) continue;

    let reasonCode: StarterAssetReasonCode | null = null;
    if (def.forYearBuilt) {
      if (yearBuilt == null) continue;
      reasonCode = def.forYearBuilt(yearBuilt);
      if (!reasonCode) continue;
    }

    if (existing.some((a) => a.category === def.category && def.matches.test(a.name))) continue;

    const lifespan = getExpectedLifespan(def.category, def.name);
    const estimatedInstallYear = yearBuilt != null && currentYear - yearBuilt < lifespan ? yearBuilt : null;

    out.push({
      key: def.key,
      name: def.name,
      category: def.category,
      recommended: def.recommended,
      reasonCode,
      reason: reasonCode ? STARTER_ASSET_REASONS[reasonCode] : null,
      estimatedInstallYear,
    });
  }
  return out;
}

/** Note saved on a starter asset so the owner knows its details still need checking. */
export const STARTER_ASSET_NOTE =
  "Added from the suggested starter list. Please confirm the brand, model and install date.";
