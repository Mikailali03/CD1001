import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, propertiesTable: {}, assetsTable: {}, serviceRecordsTable: {}, maintenanceTasksTable: {} }));
vi.mock("../logger.js", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

const { buildDemoSeed, DEMO_USER_ID, isDemoUser } = await import("../demo");

describe("demo seed", () => {
  const seed = buildDemoSeed(new Date("2026-11-11T12:00:00Z"));
  const assetIds = new Set(seed.assets.map((a) => a.id));

  it("belongs to the demo user", () => {
    expect(seed.property.userId).toBe(DEMO_USER_ID);
    expect(isDemoUser(DEMO_USER_ID)).toBe(true);
    expect(isDemoUser("user_123")).toBe(false);
    expect(seed.assets.every((a) => a.propertyId === seed.property.id)).toBe(true);
  });

  it("has unique, stable IDs so re-seeding is a no-op", () => {
    const ids = [seed.property.id, ...seed.assets.map((a) => a.id), ...seed.records.map((r) => r.id), ...seed.tasks.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(buildDemoSeed(new Date("2027-03-01")).records.map((r) => r.id)).toEqual(seed.records.map((r) => r.id));
  });

  it("only references seeded assets", () => {
    expect(seed.records.every((r) => assetIds.has(r.assetId))).toBe(true);
    expect(seed.tasks.every((t) => assetIds.has(t.assetId))).toBe(true);
  });

  it("mixes verified and self-reported records, marked the way real ones are", () => {
    const verified = seed.records.filter((r) => r.verified);
    const self = seed.records.filter((r) => !r.verified);
    expect(verified.length).toBeGreaterThan(0);
    expect(self.length).toBeGreaterThan(0);
    expect(verified.every((r) => r.companyName === "CasaService" && !r.createdByUserId)).toBe(true);
    expect(self.every((r) => r.companyName !== "CasaService" && r.createdByUserId === DEMO_USER_ID)).toBe(true);
  });

  it("shows overdue, upcoming and completed tasks plus a retired asset with history", () => {
    const today = "2026-11-11";
    const open = seed.tasks.filter((t) => !t.completedAt);
    expect(open.some((t) => t.nextDueDate < today)).toBe(true);
    expect(open.some((t) => t.nextDueDate >= today)).toBe(true);
    expect(seed.tasks.some((t) => t.completedAt)).toBe(true);
    const retired = seed.assets.filter((a) => a.retiredAt);
    expect(retired).toHaveLength(1);
    expect(seed.records.some((r) => r.assetId === retired[0]!.id)).toBe(true);
    // Tasks never sit on retired assets.
    expect(seed.tasks.some((t) => t.assetId === retired[0]!.id)).toBe(false);
  });

  it("gives Capital Outlook something to project", () => {
    const priced = seed.assets.filter((a) => !a.retiredAt && a.replacementCost && a.installDate);
    expect(priced.length).toBeGreaterThanOrEqual(5);
  });
});
