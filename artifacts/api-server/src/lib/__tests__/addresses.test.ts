import { describe, it, expect } from "vitest";
import { normalizeAddress } from "../addresses";

describe("normalizeAddress", () => {
  it("matches the same home however the street is written", () => {
    const a = normalizeAddress({ address: "123 North Oak Street, Apt 4", zipCode: "30301" });
    const b = normalizeAddress({ address: "123 N. Oak St #4", zipCode: "30301-1234" });
    expect(a).toBe(b);
    expect(a).toBe("123 n oak st unit 4|30301");
  });

  it("keeps different units apart", () => {
    expect(normalizeAddress({ address: "5 Elm Ave Unit 1", zipCode: "30301" }))
      .not.toBe(normalizeAddress({ address: "5 Elm Ave Unit 2", zipCode: "30301" }));
  });

  it("keeps the same street in different ZIP codes apart", () => {
    expect(normalizeAddress({ address: "5 Elm Ave", zipCode: "30301" }))
      .not.toBe(normalizeAddress({ address: "5 Elm Ave", zipCode: "30302" }));
  });

  it("falls back to city and state without a ZIP", () => {
    expect(normalizeAddress({ address: "5 Elm Avenue", city: "Decatur", state: "GA" })).toBe("5 elm ave|decatur|ga");
  });
});
