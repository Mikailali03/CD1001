import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, rateLimitsTable: {} }));

import { evaluate, windowStart, RATE_LIMITS } from "../rateLimit";

const HOUR = 60 * 60 * 1000;

describe("windowStart", () => {
  it("puts every moment of a window in the same bucket", () => {
    const base = Date.UTC(2026, 10, 11, 14, 0, 0);
    expect(windowStart(base, HOUR).getTime()).toBe(base);
    expect(windowStart(base + HOUR - 1, HOUR).getTime()).toBe(base);
    expect(windowStart(base + HOUR, HOUR).getTime()).toBe(base + HOUR);
  });
});

describe("evaluate", () => {
  const rule = { name: "t", limit: 3, windowMs: HOUR };
  const now = Date.UTC(2026, 10, 11, 14, 15, 0);

  it("allows up to the limit and refuses the next hit", () => {
    expect(evaluate(1, rule, now).allowed).toBe(true);
    expect(evaluate(3, rule, now).allowed).toBe(true);
    expect(evaluate(4, rule, now).allowed).toBe(false);
  });

  it("says how long until the window resets", () => {
    expect(evaluate(4, rule, now).retryAfterSec).toBe(45 * 60);
  });

  it("never asks for a zero-second wait", () => {
    expect(evaluate(4, rule, Date.UTC(2026, 10, 11, 14, 59, 59, 999)).retryAfterSec).toBe(1);
  });
});

describe("RATE_LIMITS", () => {
  it("gives every rule a distinct counter name", () => {
    const names = Object.values(RATE_LIMITS).map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
