import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("../email.js", () => ({ escapeHtml: (s: string) => s, layout: (s: string) => s, button: () => "", sendEventEmail: vi.fn() }));
vi.mock("../pushNotifications.js", () => ({ sendPushToUser: vi.fn() }));
vi.mock("../access.js", () => ({ getVerifiedEmail: vi.fn() }));

import { kindFor } from "../maintenanceNotifications";
import { daysBetween, localParts, timezoneForState } from "../timezones";

describe("kindFor", () => {
  it.each([
    [3, "due_soon"], [0, "due_soon"], [4, null],
    [-1, "overdue_1"], [-6, "overdue_1"],
    [-7, "overdue_7"], [-13, "overdue_7"],
    [-14, null], [-60, null],
  ])("%i days until due → %s", (days, kind) => expect(kindFor(days)).toBe(kind));
});

describe("timezones", () => {
  it("maps states by code or name, with a fallback", () => {
    expect(timezoneForState("GA")).toBe("America/New_York");
    expect(timezoneForState("california")).toBe("America/Los_Angeles");
    expect(timezoneForState("az")).toBe("America/Phoenix");
    expect(timezoneForState(null)).toBe(process.env.SCHEDULE_TIMEZONE || "America/New_York");
  });

  it("gives the local date and hour for a home", () => {
    // 13:30 UTC on a Monday is 8:30 in Atlanta (EST) and 5:30 in Los Angeles.
    const now = new Date("2026-11-16T13:30:00Z");
    expect(localParts(now, "America/New_York")).toEqual({ date: "2026-11-16", hour: 8, weekday: 1 });
    expect(localParts(now, "America/Los_Angeles").hour).toBe(5);
  });

  it("counts whole days between dates", () => {
    expect(daysBetween("2026-11-16", "2026-11-19")).toBe(3);
    expect(daysBetween("2026-11-16", "2026-11-09")).toBe(-7);
  });
});
