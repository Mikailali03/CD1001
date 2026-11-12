import { describe, expect, it } from "vitest";
import { checkServiceArea, DEFAULT_SERVICE_AREA, distanceMiles, parseServiceArea } from "../serviceArea.js";
import { allowedFrom, canTransition, nextStatus, type JobAction, type JobStatus } from "../jobTransitions.js";
import { isSameLocalDay, parseScheduleDate } from "../jobSchedule.js";

describe("service area", () => {
  it("defaults to metro Atlanta", () => {
    expect(parseServiceArea(undefined)).toEqual(DEFAULT_SERVICE_AREA);
    expect(parseServiceArea("  ")).toEqual(DEFAULT_SERVICE_AREA);
  });

  it("parses lat,lng,radius and an optional name", () => {
    expect(parseServiceArea("35.2271,-80.8431,30")).toEqual({
      name: "Atlanta area", centerLat: 35.2271, centerLng: -80.8431, radiusMiles: 30,
    });
    expect(parseServiceArea("35.2271, -80.8431, 30, Charlotte area").name).toBe("Charlotte area");
  });

  it("rejects malformed config instead of silently using the wrong area", () => {
    expect(() => parseServiceArea("Atlanta")).toThrow(/SERVICE_AREA/);
    expect(() => parseServiceArea("33.7,-84.3,0")).toThrow();
    expect(() => parseServiceArea("133.7,-84.3,50")).toThrow();
  });

  it("measures distance in miles", () => {
    // Atlanta to Savannah is roughly 215 miles as the crow flies.
    expect(distanceMiles(33.749, -84.388, 32.0809, -81.0912)).toBeGreaterThan(200);
    expect(distanceMiles(33.749, -84.388, 32.0809, -81.0912)).toBeLessThan(230);
  });

  it("checks homes against the radius", () => {
    expect(checkServiceArea({ lat: 33.9519, lng: -84.5499 })).toBe("inside"); // Marietta
    expect(checkServiceArea({ lat: 32.0809, lng: -81.0912 })).toBe("outside"); // Savannah
    expect(checkServiceArea({ lat: 30.2672, lng: -97.7431 })).toBe("outside"); // Austin
    expect(checkServiceArea(null)).toBe("unknown");
    expect(checkServiceArea({ lat: Number.NaN, lng: 1 })).toBe("unknown");
  });
});

describe("job transitions", () => {
  const statuses: JobStatus[] = ["open", "claimed", "en_route", "arrived", "completed", "cancelled"];
  const allowed = (action: JobAction) => statuses.filter((s) => canTransition(s, action));

  it("follows the lifecycle", () => {
    expect(allowed("accept")).toEqual(["open"]);
    expect(allowed("en_route")).toEqual(["claimed"]);
    expect(allowed("arrive")).toEqual(["en_route"]);
    expect(allowed("complete")).toEqual(["claimed", "en_route", "arrived"]);
  });

  it("only reschedules before the technician sets off", () => {
    expect(allowed("schedule")).toEqual(["claimed"]);
    expect(canTransition("completed", "schedule")).toBe(false);
  });

  it("lets the homeowner cancel until the technician is on the way", () => {
    expect(allowed("cancel")).toEqual(["open", "claimed"]);
    expect(nextStatus("claimed", "cancel")).toBe("cancelled");
  });

  it("lets a technician release an accepted job back to open", () => {
    expect(allowed("release")).toEqual(["claimed"]);
    expect(nextStatus("claimed", "release")).toBe("open");
  });

  it("treats completed and cancelled jobs as final", () => {
    const actions: JobAction[] = ["accept", "schedule", "en_route", "arrive", "complete", "cancel", "release"];
    for (const action of actions) {
      expect(canTransition("completed", action)).toBe(false);
      expect(canTransition("cancelled", action)).toBe(false);
    }
  });

  it("exposes the same rules for conditional updates", () => {
    expect(allowedFrom("cancel")).toEqual(["open", "claimed"]);
  });
});

describe("job scheduling", () => {
  it("rejects dates that don't parse instead of storing Invalid Date", () => {
    expect(parseScheduleDate("not a date")).toBeNull();
    expect(parseScheduleDate("")).toBeNull();
    expect(parseScheduleDate(42)).toBeNull();
    expect(parseScheduleDate("+020255-01-01T10:00:00Z")).toBeNull();
    expect(parseScheduleDate("2026-11-20T15:00:00Z")?.toISOString()).toBe("2026-11-20T15:00:00.000Z");
  });

  it("compares appointment days in the home's timezone, not UTC", () => {
    // 9pm Eastern on Nov 20 is already Nov 21 in UTC.
    const appointment = new Date("2026-11-21T02:00:00Z");
    const morningOf = new Date("2026-11-20T13:00:00Z"); // 8am Eastern, Nov 20
    expect(isSameLocalDay(appointment, morningOf, "America/New_York")).toBe(true);
    expect(isSameLocalDay(appointment, morningOf, "UTC")).toBe(false);
  });
});
