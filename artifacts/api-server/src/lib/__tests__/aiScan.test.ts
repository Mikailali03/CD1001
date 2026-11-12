import { describe, it, expect } from "vitest";
import { parseAssetScan } from "../aiScan";

describe("parseAssetScan", () => {
  it("accepts a well-formed reply, including markdown fences", () => {
    const raw = '```json\n{"brand":"Carrier","model":"24ABC6","serialNumber":"1234","manufactureDate":"2019-03","estimatedReplacementCost":6500,"category":"HVAC","suggestedName":"Carrier Central AC"}\n```';
    expect(parseAssetScan(raw)).toEqual({
      brand: "Carrier",
      model: "24ABC6",
      serialNumber: "1234",
      manufactureDate: "2019-03",
      estimatedReplacementCost: 6500,
      category: "HVAC",
      suggestedName: "Carrier Central AC",
    });
  });

  it("drops invalid fields instead of passing them through", () => {
    const r = parseAssetScan(JSON.stringify({
      brand: "Rheem",
      model: 42,
      manufactureDate: "sometime in spring",
      estimatedReplacementCost: -5,
      category: "Spaceship",
      suggestedName: "",
      extra: "<script>",
    }));
    expect(r).toEqual({
      brand: "Rheem",
      model: null,
      serialNumber: null,
      manufactureDate: null,
      estimatedReplacementCost: null,
      category: null,
      suggestedName: null,
    });
  });

  it("normalizes dates to YYYY-MM and rejects impossible ones", () => {
    const date = (d: string) => parseAssetScan(JSON.stringify({ brand: "x", manufactureDate: d }))?.manufactureDate;
    expect(date("2019-3")).toBe("2019-03");
    expect(date("2019-03-14")).toBe("2019-03");
    expect(date("03/2019")).toBe("2019-03");
    expect(date("2019-13")).toBeNull();
    expect(date("1850-01")).toBeNull();
  });

  it("coerces numeric strings and truncates long text", () => {
    const r = parseAssetScan(JSON.stringify({ estimatedReplacementCost: "1200.4", brand: "B".repeat(500) }));
    expect(r?.estimatedReplacementCost).toBe(1200);
    expect(r?.brand).toHaveLength(80);
  });

  it.each([
    ["not json", "Sorry, I can't read that"],
    ["an array", "[1,2,3]"],
    ["null", "null"],
    ["a string", '"hello"'],
    ["all-null fields", '{"brand":null,"model":null}'],
    ["an empty object", "{}"],
  ])("rejects %s", (_label, raw) => expect(parseAssetScan(raw)).toBeNull());
});
