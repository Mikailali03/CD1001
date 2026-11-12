/**
 * Unclaimed dossiers: when an owner deletes their account, a home with service
 * history is detached and kept with only the facts, and the next owner at the
 * same address can inherit it. The DB is faked; the test asserts what gets
 * cleared, deleted and moved.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const results: unknown[][] = [];
  const ops: { op: string; table: string; values?: unknown; where?: unknown }[] = [];
  const chain = () => {
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.innerJoin = () => c;
    c.where = () => Promise.resolve(results.shift() ?? []);
    return c;
  };
  const name = (t: { __t: string }) => t.__t;
  const executor = {
    select: vi.fn(() => chain()),
    selectDistinct: vi.fn(() => chain()),
    update: vi.fn((t: { __t: string }) => ({
      set: (values: unknown) => ({
        where: (where: unknown) => {
          ops.push({ op: "update", table: name(t), values, where });
          return Object.assign(Promise.resolve(), { returning: () => Promise.resolve(results.shift() ?? []) });
        },
      }),
    })),
    delete: vi.fn((t: { __t: string }) => ({
      where: (where: unknown) => {
        ops.push({ op: "delete", table: name(t), where });
        return Promise.resolve();
      },
    })),
    insert: vi.fn((t: { __t: string }) => ({
      values: (values: unknown) => {
        ops.push({ op: "insert", table: name(t), values });
        return Promise.resolve();
      },
    })),
  };
  return { results, ops, executor, queue: (...r: unknown[][]) => { results.length = 0; results.push(...r); ops.length = 0; } };
});

vi.mock("@workspace/db", () => ({
  db: mocks.executor,
  propertiesTable: { __t: "properties" },
  assetsTable: { __t: "assets" },
  serviceRecordsTable: { __t: "service_records" },
  propertyCollaboratorsTable: { __t: "collaborators" },
  marketplaceJobsTable: { __t: "marketplace_jobs" },
  auditLogTable: { __t: "audit_log" },
}));
vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ eq: val }),
  ne: (col: unknown, val: unknown) => ({ ne: val }),
  and: (...args: unknown[]) => ({ and: args }),
  inArray: (col: unknown, vals: unknown) => ({ inArray: vals }),
  isNotNull: () => ({ isNotNull: true }),
  count: () => ({ count: true }),
}));
vi.mock("../logger.js", () => ({ logger: { error: vi.fn() } }));

const { releaseProperty, findUnclaimedHistory, mergeUnclaimedHistory, propertiesWithHistory } = await import("../dossiers");
const { normalizeAddress } = await import("../addresses");

const tx = mocks.executor as never;
const HOME = {
  id: "p1",
  userId: "seller",
  ownerEmail: "seller@example.com",
  name: "Our first home",
  photoUrl: "/objects/house.jpg",
  address: "123 North Oak Street",
  city: "Decatur",
  state: "GA",
  zipCode: "30030",
};

beforeEach(() => mocks.queue());

describe("releaseProperty (owner deleted their account)", () => {
  it("keeps only the facts and detaches the home from its owner", async () => {
    mocks.queue([HOME], [{ id: "a1" }, { id: "a2" }]);
    await releaseProperty(tx, "p1", "seller");

    const find = (op: string, table: string) => mocks.ops.filter((o) => o.op === op && o.table === table);

    // Asset photos and free-text notes go; brand, model, dates, cost stay.
    expect(find("update", "assets")).toEqual([
      expect.objectContaining({ values: { notes: null, photoUrl: null }, where: { inArray: ["a1", "a2"] } }),
    ]);
    // Receipts and who-typed-it go; date, description, cost and verified stay.
    expect(find("update", "service_records")).toEqual([
      expect.objectContaining({ values: { receiptUrl: null, createdByUserId: null } }),
    ]);
    // Service requests (phone numbers, descriptions) and collaborators are removed.
    expect(find("delete", "marketplace_jobs")).toHaveLength(1);
    expect(find("delete", "collaborators")).toHaveLength(1);

    const [prop] = find("update", "properties");
    expect(prop!.values).toMatchObject({
      userId: null,
      ownerEmail: null,
      photoUrl: null,
      name: HOME.address, // the owner's name for the home is personal
      normalizedAddress: normalizeAddress(HOME),
    });
    expect((prop!.values as { releasedAt: unknown }).releasedAt).toBeInstanceOf(Date);

    expect(find("insert", "audit_log")).toEqual([
      expect.objectContaining({ values: expect.objectContaining({ action: "property.released", entityId: "p1", actorUserId: "seller" }) }),
    ]);
  });

  it("never touches service records it isn't keeping (no assets, nothing to strip)", async () => {
    mocks.queue([HOME], []);
    await releaseProperty(tx, "p1", "seller");
    expect(mocks.ops.some((o) => o.table === "service_records" || o.table === "marketplace_jobs")).toBe(false);
    expect(mocks.ops.some((o) => o.op === "update" && o.table === "properties")).toBe(true);
  });

  it("does nothing for a home that no longer exists", async () => {
    mocks.queue([]);
    await releaseProperty(tx, "gone", "seller");
    expect(mocks.ops).toEqual([]);
  });
});

describe("propertiesWithHistory (which homes are kept on account deletion)", () => {
  it("returns only homes with at least one service record", async () => {
    mocks.queue([{ propertyId: "p1" }]);
    expect(await propertiesWithHistory(["p1", "p2"])).toEqual(new Set(["p1"]));
  });

  it("skips the query when the user owns nothing", async () => {
    mocks.executor.selectDistinct.mockClear();
    expect(await propertiesWithHistory([])).toEqual(new Set());
    expect(mocks.executor.selectDistinct).not.toHaveBeenCalled();
  });
});

describe("findUnclaimedHistory (offer to a new owner at the same address)", () => {
  const buyerHome = { id: "p9", address: "123 N. Oak St", zipCode: "30030-1111" };

  it("summarises history left at the address", async () => {
    mocks.queue([{ id: "p1" }], [{ n: 4 }], [{ verified: true }, { verified: false }, { verified: false }]);
    expect(await findUnclaimedHistory(buyerHome)).toEqual({
      dossierIds: ["p1"],
      assetCount: 4,
      recordCount: 3,
      verifiedCount: 1,
    });
  });

  it("offers nothing when no dossier matches", async () => {
    mocks.queue([]);
    expect(await findUnclaimedHistory(buyerHome)).toBeNull();
  });

  it("offers nothing when the dossier has no records (the home is added without verification)", async () => {
    mocks.queue([{ id: "p1" }], [{ n: 2 }], []);
    expect(await findUnclaimedHistory(buyerHome)).toBeNull();
  });

  it("matches the seller's and buyer's spelling of the address", () => {
    expect(normalizeAddress(buyerHome)).toBe(normalizeAddress(HOME));
  });
});

describe("mergeUnclaimedHistory (claim approved)", () => {
  it("moves the dossier's assets to the new owner's home and deletes the empty dossier", async () => {
    mocks.queue([{ id: "p1" }], [{ id: "a1" }, { id: "a2" }]);
    const moved = await mergeUnclaimedHistory(tx, { id: "p9", address: "123 N Oak St", zipCode: "30030" }, "admin");
    expect(moved).toBe(2);

    const move = mocks.ops.find((o) => o.op === "update" && o.table === "assets");
    expect(move!.values).toMatchObject({ propertyId: "p9" });
    expect(move!.where).toEqual({ inArray: ["p1"] });
    expect(mocks.ops.find((o) => o.op === "delete" && o.table === "properties")!.where).toEqual({ inArray: ["p1"] });
    expect(mocks.ops.find((o) => o.op === "insert" && o.table === "audit_log")!.values)
      .toMatchObject({ action: "property.history_inherited", entityId: "p9", actorUserId: "admin" });
  });

  it("is a no-op when there's nothing to inherit", async () => {
    mocks.queue([]);
    expect(await mergeUnclaimedHistory(tx, { id: "p9", address: "9 Pine St", zipCode: "30030" }, "admin")).toBe(0);
    expect(mocks.ops).toEqual([]);
  });
});
