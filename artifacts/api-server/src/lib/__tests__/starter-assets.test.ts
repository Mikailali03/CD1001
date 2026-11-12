import { describe, it, expect } from "vitest";
import { inferHomeType, isStarterAssetKey, suggestStarterAssets } from "@workspace/maintenance-specs";

const keys = (s: { key: string }[]) => s.map((x) => x.key);

describe("suggestStarterAssets", () => {
  it("suggests the core systems for every house", () => {
    const s = suggestStarterAssets({ yearBuilt: 2015, homeType: "single_family", currentYear: 2026 });
    expect(keys(s)).toEqual(expect.arrayContaining(["hvac", "water_heater", "roof", "electrical_panel"]));
    expect(s.find((x) => x.key === "hvac")!.recommended).toBe(true);
    expect(s.find((x) => x.key === "washer")!.recommended).toBe(false);
  });

  it("skips the roof and garage for condos", () => {
    const s = keys(suggestStarterAssets({ yearBuilt: 2015, homeType: "condo", currentYear: 2026 }));
    expect(s).not.toContain("roof");
    expect(s).not.toContain("garage_door");
    expect(s).toContain("water_heater");
  });

  it("estimates install year as year built only while the original is likely still in place", () => {
    const s = suggestStarterAssets({ yearBuilt: 2010, homeType: "single_family", currentYear: 2026 });
    // 16-year-old house: a 40-year panel is probably original, a 12-year water heater isn't.
    expect(s.find((x) => x.key === "electrical_panel")!.estimatedInstallYear).toBe(2010);
    expect(s.find((x) => x.key === "water_heater")!.estimatedInstallYear).toBeNull();
  });

  it("leaves install year unknown when year built is unknown or nonsense", () => {
    for (const yearBuilt of [null, undefined, 0, 3000]) {
      const s = suggestStarterAssets({ yearBuilt, homeType: "single_family", currentYear: 2026 });
      expect(s.every((x) => x.estimatedInstallYear === null)).toBe(true);
      expect(keys(s)).not.toContain("supply_plumbing");
    }
  });

  it.each([
    [1955, "supply_plumbing", "galvanized_pipes"],
    [1990, "supply_plumbing", "polybutylene_pipes"],
    [1940, "wiring", "knob_and_tube"],
    [1970, "wiring", "aluminum_wiring"],
  ])("flags age-related checks for a %i home (%s: %s)", (yearBuilt, key, reasonCode) => {
    const s = suggestStarterAssets({ yearBuilt, homeType: "single_family", currentYear: 2026 });
    const hit = s.find((x) => x.key === key);
    expect(hit?.reasonCode).toBe(reasonCode);
    expect(hit?.reason).toBeTruthy();
  });

  it("doesn't suggest age checks for homes outside the risky years", () => {
    const s = keys(suggestStarterAssets({ yearBuilt: 2005, homeType: "single_family", currentYear: 2026 }));
    expect(s).not.toContain("supply_plumbing");
    expect(s).not.toContain("wiring");
  });

  it("skips anything already tracked in the same category", () => {
    const s = keys(suggestStarterAssets({
      yearBuilt: 2015,
      homeType: "single_family",
      currentYear: 2026,
      existing: [
        { name: "Rheem Water Heater", category: "Plumbing" },
        { name: "Trane Heat Pump", category: "HVAC" },
        // Same word, different category: still suggested.
        { name: "Roof vent fan", category: "Other" },
      ],
    }));
    expect(s).not.toContain("water_heater");
    expect(s).not.toContain("hvac");
    expect(s).toContain("roof");
  });

  it("only uses known keys", () => {
    const s = suggestStarterAssets({ yearBuilt: 1970, homeType: "single_family", currentYear: 2026 });
    expect(s.every((x) => isStarterAssetKey(x.key))).toBe(true);
    expect(isStarterAssetKey("hot_tub")).toBe(false);
  });
});

describe("inferHomeType", () => {
  it.each([
    ["123 Peachtree St Apt 4B", "condo"],
    ["123 Peachtree St #4", "condo"],
    ["55 Ponce Ave, Unit 210", "condo"],
    ["1427 Magnolia Ave", "single_family"],
    ["10 United Way", "single_family"],
    [null, "single_family"],
  ])("%j → %s", (address, type) => expect(inferHomeType(address)).toBe(type));
});
