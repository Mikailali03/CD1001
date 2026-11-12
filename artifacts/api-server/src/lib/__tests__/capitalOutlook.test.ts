import { describe, it, expect } from "vitest";
import { buildCapitalOutlook, getUrgency } from "../capitalOutlook";

const NOW = new Date("2026-06-01T12:00:00Z");

const asset = (over: Partial<Parameters<typeof buildCapitalOutlook>[0][number]>) => ({
  id: over.id ?? "a",
  name: "Central AC",
  category: "HVAC",
  installDate: "2016-04-01",
  replacementCost: "6000",
  ...over,
});

describe("getUrgency", () => {
  it.each([
    [null, "unknown"],
    [-2, "critical"],
    [3, "critical"],
    [4, "warning"],
    [8, "warning"],
    [9, "good"],
  ] as const)("%s years left → %s", (years, urgency) => expect(getUrgency(years)).toBe(urgency));
});

describe("buildCapitalOutlook", () => {
  it("projects replacement year, life used and urgency from install date and lifespan", () => {
    const { assets } = buildCapitalOutlook([asset({})], { now: NOW });
    expect(assets[0]).toMatchObject({
      installYear: 2016,
      expectedLifespanYears: 15,
      replacementYear: 2031,
      yearsRemaining: 5,
      ageYears: 10,
      percentLifeUsed: 67,
      urgency: "warning",
      replacementCost: 6000,
      replacementCostIsEstimate: false,
    });
  });

  it("applies the regional lifespan", () => {
    const { assets } = buildCapitalOutlook([asset({})], { now: NOW, state: "GA" });
    expect(assets[0]!.expectedLifespanYears).toBe(13);
    expect(assets[0]!.replacementYear).toBe(2029);
  });

  it("estimates missing costs, flags them, and totals the estimated share", () => {
    const out = buildCapitalOutlook(
      [asset({ id: "entered" }), asset({ id: "est", name: "Water Heater", category: "Plumbing", replacementCost: null })],
      { now: NOW, state: "GA" },
    );
    const est = out.assets.find((a) => a.id === "est")!;
    expect(est.replacementCostIsEstimate).toBe(true);
    expect(est.replacementCost).toBeGreaterThan(0);
    expect(out.totalTrackedValue).toBe(6000 + est.replacementCost!);
    expect(out.estimatedTrackedValue).toBe(est.replacementCost);
  });

  it("leaves cost null when it can't be estimated", () => {
    const { assets, totalTrackedValue } = buildCapitalOutlook(
      [asset({ name: "Shed", category: "Other", replacementCost: null })],
      { now: NOW },
    );
    expect(assets[0]).toMatchObject({ replacementCost: null, replacementCostIsEstimate: false });
    expect(totalTrackedValue).toBe(0);
  });

  it("builds a 21-year timeline and 5/10-year totals", () => {
    const out = buildCapitalOutlook(
      [
        asset({ id: "1", installDate: "2016-01-01", replacementCost: 6000 }), // 2031
        asset({ id: "2", name: "Fridge", category: "Appliance", installDate: "2020-01-01", replacementCost: 2000 }), // 2034
      ],
      { now: NOW },
    );
    expect(out.timeline).toHaveLength(21);
    expect(out.timeline[0]!.year).toBe(2026);
    expect(out.timeline.find((t) => t.year === 2031)).toMatchObject({ projectedCost: 6000, assetNames: ["Central AC"] });
    expect(out.summary.next5YearCost).toBe(0); // 2026–2030
    expect(out.summary.next10YearCost).toBe(8000); // 2026–2035
    expect(out.summary.nextReplacement).toEqual({ name: "Central AC", year: 2031, cost: 6000, costIsEstimate: false });
  });

  it("counts assets already past their expected life as due this year", () => {
    const out = buildCapitalOutlook([asset({ installDate: "2005-01-01", replacementCost: 7000 })], { now: NOW });
    expect(out.assets[0]!.yearsRemaining).toBeLessThan(0);
    expect(out.assets[0]!.urgency).toBe("critical");
    expect(out.timeline[0]).toMatchObject({ year: 2026, projectedCost: 7000 });
    expect(out.summary.next5YearCost).toBe(7000);
    expect(out.summary.nextReplacement).toMatchObject({ year: 2026, cost: 7000 });
  });

  it("separates estimated amounts in the timeline and summary", () => {
    const out = buildCapitalOutlook(
      [asset({ installDate: "2005-01-01", replacementCost: null })],
      { now: NOW },
    );
    const cost = out.assets[0]!.replacementCost!;
    expect(out.timeline[0]).toMatchObject({ projectedCost: cost, estimatedCost: cost });
    expect(out.summary.next5YearEstimatedCost).toBe(cost);
    expect(out.summary.nextReplacement?.costIsEstimate).toBe(true);
  });

  it("handles assets with no install date", () => {
    const out = buildCapitalOutlook([asset({ installDate: null })], { now: NOW });
    expect(out.assets[0]).toMatchObject({ replacementYear: null, urgency: "unknown", percentLifeUsed: null });
    expect(out.summary.nextReplacement).toBeNull();
    expect(out.totalTrackedValue).toBe(6000);
  });
});
