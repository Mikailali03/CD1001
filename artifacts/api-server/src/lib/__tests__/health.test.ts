import { describe, it, expect } from "vitest";
import {
  calcAssetHealth,
  calcAssetHealthScore,
  calcHomeHealth,
  healthGrade,
  getExpectedLifespan,
  getLifespanInfo,
  estimateReplacementCost,
  resolveReplacementCost,
  normalizeState,
  MAINTENANCE_SPECS,
  SOURCES,
  COST_BASE_YEAR,
} from "@workspace/maintenance-specs";
import { calcAssetScore, calcHealthScore } from "../../health-score";

const NOW = new Date("2026-06-01T12:00:00Z");
const yearsAgo = (n: number) => new Date(NOW.getTime() - n * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);

describe("lifespan table", () => {
  it("keeps the published per-type lifespans", () => {
    expect(getExpectedLifespan("Plumbing", "Rheem Water Heater")).toBe(12);
    expect(getExpectedLifespan("HVAC", "Trane Furnace")).toBe(20);
    expect(getExpectedLifespan("Appliance", "Bosch Dishwasher")).toBe(12); // not "washer"
    expect(getExpectedLifespan("Appliance", "LG Washer")).toBe(11);
    expect(getExpectedLifespan("Electrical", "Main Panel")).toBe(40);
    expect(getExpectedLifespan("Other", "Mystery thing")).toBe(15);
    expect(getExpectedLifespan("Nonsense", "x")).toBe(15);
  });

  it("cites a known source for every lifespan and maintenance interval", () => {
    expect(SOURCES[getLifespanInfo("HVAC", "AC unit").source]).toBeDefined();
    for (const specs of Object.values(MAINTENANCE_SPECS)) {
      for (const spec of specs) expect(SOURCES[spec.source], spec.title).toBeDefined();
    }
  });

  it("shortens HVAC and roofs in hot-humid states and leaves mixed climates alone", () => {
    expect(getExpectedLifespan("HVAC", "Central AC", "GA")).toBe(13); // 15 × 0.85
    expect(getExpectedLifespan("Roof", "Asphalt shingle roof", "Florida")).toBe(19); // 22 × 0.85
    expect(getExpectedLifespan("HVAC", "Central AC", "VA")).toBe(15);
    expect(getExpectedLifespan("Appliance", "Fridge", "GA")).toBe(14);
    expect(getExpectedLifespan("HVAC", "Central AC", null)).toBe(15);
  });

  it("normalizes state codes and names", () => {
    expect(normalizeState("ga")).toBe("GA");
    expect(normalizeState(" Georgia ")).toBe("GA");
    expect(normalizeState("Narnia")).toBeNull();
    expect(normalizeState(undefined)).toBeNull();
  });
});

describe("replacement cost estimates", () => {
  it("applies region factor and inflation from the base year", () => {
    const base = estimateReplacementCost("Plumbing", "Water Heater", null, new Date(`${COST_BASE_YEAR}-06-01`));
    expect(base).toBe(1800);
    // Two years of 3.5% in the South (0.9): 1800 × 0.9 × 1.035² ≈ 1735 → 1750
    expect(estimateReplacementCost("Plumbing", "Water Heater", "GA", new Date(`${COST_BASE_YEAR + 2}-06-01`))).toBe(1750);
  });

  it("doesn't estimate categories too varied to price", () => {
    expect(estimateReplacementCost("Structural", "Foundation", "GA", NOW)).toBeNull();
    expect(estimateReplacementCost("Other", "Shed", "GA", NOW)).toBeNull();
  });

  it("prefers the owner's figure and flags estimates", () => {
    expect(resolveReplacementCost({ category: "HVAC", name: "AC", replacementCost: "4200.00" }, "GA", NOW))
      .toEqual({ cost: 4200, isEstimate: false });
    const est = resolveReplacementCost({ category: "HVAC", name: "AC", replacementCost: null }, "GA", NOW);
    expect(est.isEstimate).toBe(true);
    expect(est.cost).toBeGreaterThan(0);
    expect(resolveReplacementCost({ category: "Other", name: "x" }, null, NOW)).toEqual({ cost: null, isEstimate: false });
  });
});

describe("asset health score", () => {
  const ac = { category: "HVAC", name: "Central AC", status: "unverified" };

  it("is 100 for a new, recently serviced asset under warranty", () => {
    expect(calcAssetHealthScore(
      { ...ac, installDate: yearsAgo(0.5), lastServiceDate: yearsAgo(0.2), warrantyExpiry: "2030-01-01" },
      { now: NOW },
    )).toBe(100);
  });

  it("loses up to 60 points for age, and 10 more past expected life", () => {
    expect(calcAssetHealthScore({ ...ac, installDate: yearsAgo(7.5) }, { now: NOW })).toBe(70);
    expect(calcAssetHealthScore({ ...ac, installDate: yearsAgo(14.9) }, { now: NOW })).toBe(40);
    expect(calcAssetHealthScore({ ...ac, installDate: yearsAgo(20) }, { now: NOW })).toBe(30);
  });

  it("uses the regional lifespan", () => {
    const vaScore = calcAssetHealthScore({ ...ac, installDate: yearsAgo(13) }, { now: NOW, state: "VA" });
    const gaScore = calcAssetHealthScore({ ...ac, installDate: yearsAgo(13) }, { now: NOW, state: "GA" });
    expect(gaScore).toBeLessThan(vaScore);
  });

  it("rewards recent service and penalises stale, missing, or overdue maintenance", () => {
    const base = { ...ac, installDate: yearsAgo(7.5) };
    expect(calcAssetHealthScore({ ...base, lastServiceDate: yearsAgo(0.5) }, { now: NOW })).toBe(80);
    expect(calcAssetHealthScore({ ...base, lastServiceDate: yearsAgo(3) }, { now: NOW })).toBe(65);
    expect(calcAssetHealthScore({ ...base, lastServiceDate: null }, { now: NOW })).toBe(65);
    expect(calcAssetHealthScore({ ...base, overdueTaskCount: 2 }, { now: NOW })).toBe(60);
    expect(calcAssetHealthScore({ ...base, overdueTaskCount: 10 }, { now: NOW })).toBe(50); // capped at −20
  });

  it("doesn't penalise a brand-new asset for having no service yet", () => {
    expect(calcAssetHealthScore({ ...ac, installDate: yearsAgo(0.5), lastServiceDate: null }, { now: NOW })).toBe(98);
  });

  it("penalises unknown age and needs-attention status, and clamps to 0–100", () => {
    expect(calcAssetHealthScore({ ...ac }, { now: NOW })).toBe(90);
    expect(calcAssetHealthScore({ ...ac, status: "needs_attention", installDate: yearsAgo(40), lastServiceDate: null, overdueTaskCount: 9 }, { now: NOW })).toBe(0);
  });

  it("ignores asset status 'verified' (homeowners can't set it)", () => {
    expect(calcAssetHealthScore({ ...ac, status: "verified", installDate: yearsAgo(7.5) }, { now: NOW }))
      .toBe(calcAssetHealthScore({ ...ac, installDate: yearsAgo(7.5) }, { now: NOW }));
  });

  it("reports age and lifespan", () => {
    const r = calcAssetHealth({ ...ac, installDate: yearsAgo(5) }, { now: NOW, state: "GA" });
    expect(r.ageYears).toBe(5);
    expect(r.lifespanYears).toBe(13);
  });
});

describe("home health score", () => {
  it("is A with no assets and nothing overdue", () => {
    expect(calcHomeHealth([], 0)).toEqual({ score: 100, grade: "A", assetAgeScore: 100, overdueScore: 100 });
  });

  it("lets critical assets dominate the asset half", () => {
    // one critical (20) at weight 1, two healthy (90) at 0.1 → (20 + 18) / 1.2 ≈ 32
    const r = calcHomeHealth([20, 90, 90], 0);
    expect(r.assetAgeScore).toBe(32);
    expect(r.score).toBe(66);
    expect(r.grade).toBe("C");
  });

  it("takes 15 per overdue task and adds 1 per recent completion, capped at 100", () => {
    expect(calcHomeHealth([80], 2).score).toBe(85);
    expect(calcHomeHealth([80], 2, 3).score).toBe(88);
    expect(calcHomeHealth([80], 0, 50).score).toBe(100);
    expect(calcHomeHealth([80], 10).overdueScore).toBe(0);
  });

  it("uses the shared grade thresholds", () => {
    expect([95, 80, 65, 50, 10].map(healthGrade)).toEqual(["A", "B", "C", "D", "F"]);
  });
});

describe("server wrappers", () => {
  it("feed service history into the asset score", () => {
    const asset = { id: "a1", name: "Central AC", category: "HVAC", installDate: yearsAgo(7.5), status: "unverified" };
    const ctx = { lastServiceDates: new Map([["a1", yearsAgo(0.3)]]), overdueCounts: new Map<string, number>(), now: NOW };
    expect(calcAssetScore(asset, ctx).score).toBe(80);
    const neverServiced = { lastServiceDates: new Map<string, string>(), overdueCounts: new Map([["a1", 1]]), now: NOW };
    expect(calcAssetScore(asset, neverServiced).score).toBe(60);
  });

  it("compute the home score from asset scores", () => {
    const scores = [{ assetId: "a", assetName: "A", category: "HVAC", score: 20, ageYears: 1, lifespanYears: 15 }];
    expect(calcHealthScore(scores, 0).score).toBe(60);
  });
});
