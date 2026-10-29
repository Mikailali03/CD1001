/**
 * Integration tests for DELETE /api/user
 *
 * All external dependencies (DB, Clerk, Stripe, ObjectStorage) are mocked so
 * the tests run without network access or environment secrets.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ---------------------------------------------------------------------------
// Hoisted mock references — must be declared before vi.mock() factories run.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  // Auth
  const getAuth = vi.fn(() => ({ userId: null as string | null }));

  // Clerk client
  const clerkGetUser = vi.fn<() => Promise<{ emailAddresses: { emailAddress: string }[] }>>(() =>
    Promise.resolve({ emailAddresses: [{ emailAddress: "test@example.com" }] })
  );
  const clerkDeleteUser = vi.fn<(userId: string) => Promise<void>>(() => Promise.resolve());

  // Stripe
  const stripeSubscriptionsCancel = vi.fn(() => Promise.resolve({}));

  // Object storage
  const objectDelete = vi.fn(() => Promise.resolve());
  const getObjectEntityFile = vi.fn(() => Promise.resolve({ delete: objectDelete }));
  const normalizeObjectEntityPath = vi.fn((p: string) => p);

  // DB transaction-level operations (tracked for assertions)
  const txDelete = vi.fn((_table: { __table: string }) => ({ where: vi.fn().mockResolvedValue(undefined) }));
  const txUpdate = vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  }));
  // marketplace jobs query inside transaction — returns empty list by default
  const txSelectWhere = vi.fn().mockResolvedValue([]);
  const txSelect = vi.fn(() => ({
    from: vi.fn(() => ({ where: txSelectWhere })),
  }));

  // db.select() results queue — each call pops the next value
  // Default: [[]] for subscription, [] for lockerFiles, [] for properties
  const selectResults: unknown[][] = [[], [], []];
  let selectCallIdx = 0;

  const createSelectChain = (result: unknown[]) => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => Promise.resolve(result)),
      innerJoin: vi.fn(() => chain),
    };
    return chain;
  };

  const dbSelectImpl = vi.fn(() => {
    const result = selectResults[selectCallIdx] ?? [];
    selectCallIdx++;
    return createSelectChain(result);
  });

  const resetSelectQueue = (...results: unknown[][]) => {
    selectResults.length = 0;
    results.forEach((r) => selectResults.push(r));
    selectCallIdx = 0;
  };

  const dbTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
    const tx = { delete: txDelete, update: txUpdate, select: txSelect };
    await cb(tx);
  });

  return {
    getAuth,
    clerkGetUser,
    clerkDeleteUser,
    stripeSubscriptionsCancel,
    objectDelete,
    getObjectEntityFile,
    normalizeObjectEntityPath,
    txDelete,
    txUpdate,
    txSelect,
    txSelectWhere,
    dbSelectImpl,
    dbTransaction,
    resetSelectQueue,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@workspace/db", () => {
  // Unique sentinel objects so we can assert which table was passed to delete/update
  const userProfilesTable = { __table: "userProfilesTable" };
  const propertiesTable = { __table: "propertiesTable" };
  const assetsTable = { __table: "assetsTable" };
  const pushTokensTable = { __table: "pushTokensTable" };
  const subscriptionsTable = { __table: "subscriptionsTable" };
  const lockerFoldersTable = { __table: "lockerFoldersTable" };
  const lockerFilesTable = { __table: "lockerFilesTable" };
  const propertyTransfersTable = { __table: "propertyTransfersTable" };
  const marketplaceJobsTable = { __table: "marketplaceJobsTable" };
  const propertyCollaboratorsTable = { __table: "propertyCollaboratorsTable" };
  const serviceRecordsTable = { __table: "serviceRecordsTable" };

  return {
    db: {
      select: mocks.dbSelectImpl,
      transaction: mocks.dbTransaction,
    },
    // drizzle helpers — return their arguments (enough for the route to compose them)
    eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
    or: vi.fn((...args: unknown[]) => ({ op: "or", args })),
    and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
    inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
    isNull: vi.fn((col: unknown) => ({ op: "isNull", col })),
    // Tables
    userProfilesTable,
    propertiesTable,
    assetsTable,
    pushTokensTable,
    subscriptionsTable,
    lockerFoldersTable,
    lockerFilesTable,
    propertyTransfersTable,
    marketplaceJobsTable,
    propertyCollaboratorsTable,
    serviceRecordsTable,
  };
});

vi.mock("@clerk/express", () => ({
  getAuth: mocks.getAuth,
  clerkMiddleware: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  clerkClient: {
    users: {
      getUser: mocks.clerkGetUser,
      deleteUser: mocks.clerkDeleteUser,
    },
  },
}));

vi.mock("../../stripeClient.js", () => ({
  getUncachableStripeClient: vi.fn(() => ({
    subscriptions: { cancel: mocks.stripeSubscriptionsCancel },
  })),
}));

vi.mock("../../lib/objectStorage.js", () => ({
  ObjectStorageService: vi.fn(() => ({
    normalizeObjectEntityPath: mocks.normalizeObjectEntityPath,
    getObjectEntityFile: mocks.getObjectEntityFile,
  })),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Build a minimal test Express app
// ---------------------------------------------------------------------------
// Import the router AFTER vi.mock() calls so it picks up mocked modules.
const { default: userProfileRouter } = await import("../user-profile.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", userProfileRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("DELETE /api/user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as "test-user-123"
    mocks.getAuth.mockReturnValue({ userId: "test-user-123" });
    // Clerk: user exists with one email
    mocks.clerkGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "test@example.com" }],
    });
    mocks.clerkDeleteUser.mockResolvedValue(undefined);
    // DB: no subscription, no locker files, no properties
    mocks.resetSelectQueue([], [], []);
    // Marketplace jobs inside transaction: none
    mocks.txSelectWhere.mockResolvedValue([]);
    mocks.txDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mocks.txUpdate.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    });
    mocks.dbTransaction.mockImplementation(async (cb) => {
      const tx = {
        delete: mocks.txDelete,
        update: mocks.txUpdate,
        select: mocks.txSelect,
      };
      await cb(tx);
    });
    mocks.txSelect.mockReturnValue({
      from: vi.fn(() => ({ where: mocks.txSelectWhere })),
    });
  });

  // ── Happy path ─────────────────────────────────────────────────────────
  it("returns 204 and deletes the user account end-to-end", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/user");

    expect(res.status).toBe(204);
  });

  it("runs the DB transaction and deletes the expected rows", async () => {
    const app = buildApp();
    await request(app).delete("/api/user");

    // Transaction must have been called
    expect(mocks.dbTransaction).toHaveBeenCalledOnce();

    // The transaction should delete from all core tables
    const deletedTableNames = mocks.txDelete.mock.calls.map(
      ([table]) => table.__table
    );
    expect(deletedTableNames).toContain("userProfilesTable");
    expect(deletedTableNames).toContain("propertiesTable");
    expect(deletedTableNames).toContain("pushTokensTable");
    expect(deletedTableNames).toContain("subscriptionsTable");
  });

  it("deletes the Clerk user as the final step", async () => {
    const app = buildApp();
    await request(app).delete("/api/user");

    expect(mocks.clerkDeleteUser).toHaveBeenCalledOnce();
    expect(mocks.clerkDeleteUser).toHaveBeenCalledWith("test-user-123");
  });

  // ── Stripe subscription cancellation ───────────────────────────────────
  it("cancels an active Stripe subscription before deleting DB rows", async () => {
    // Provide a subscription row
    mocks.resetSelectQueue(
      [{ stripeSubscriptionId: "sub_abc123" }], // subscriptions
      [], // lockerFiles
      [], // properties
    );

    const app = buildApp();
    const res = await request(app).delete("/api/user");

    expect(res.status).toBe(204);
    expect(mocks.stripeSubscriptionsCancel).toHaveBeenCalledWith("sub_abc123");
  });

  it("still succeeds when the Stripe subscription is already cancelled", async () => {
    mocks.resetSelectQueue(
      [{ stripeSubscriptionId: "sub_already_gone" }],
      [],
      [],
    );
    mocks.stripeSubscriptionsCancel.mockRejectedValueOnce({
      statusCode: 404,
      code: "resource_missing",
    });

    const app = buildApp();
    const res = await request(app).delete("/api/user");

    expect(res.status).toBe(204);
  });

  // ── Clerk already-deleted resilience ───────────────────────────────────
  it("still succeeds (204) if Clerk user was already deleted on a prior attempt", async () => {
    // getUser returns 404 — prior attempt deleted the Clerk account
    mocks.clerkGetUser.mockRejectedValueOnce({ status: 404 });
    // deleteUser also returns 404
    mocks.clerkDeleteUser.mockRejectedValueOnce({ status: 404 });

    const app = buildApp();
    const res = await request(app).delete("/api/user");

    expect(res.status).toBe(204);
    // DB transaction should still have run
    expect(mocks.dbTransaction).toHaveBeenCalledOnce();
  });

  // ── Edge cases: auth ────────────────────────────────────────────────────
  it("returns 401 for unauthenticated requests", async () => {
    mocks.getAuth.mockReturnValue({ userId: null });

    const app = buildApp();
    const res = await request(app).delete("/api/user");

    expect(res.status).toBe(401);
    // No data should have been touched
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
    expect(mocks.clerkDeleteUser).not.toHaveBeenCalled();
  });

  it("returns 403 for the demo user", async () => {
    // Demo mode is triggered by the x-demo-token header
    const app = buildApp();
    const res = await request(app)
      .delete("/api/user")
      .set("x-demo-token", "casa-demo-preview-2025");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: expect.stringContaining("demo") });
    // No data should have been touched
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
    expect(mocks.clerkDeleteUser).not.toHaveBeenCalled();
  });

  // ── Error handling ──────────────────────────────────────────────────────
  it("returns 500 if the DB transaction fails", async () => {
    mocks.dbTransaction.mockRejectedValueOnce(new Error("DB connection lost"));

    const app = buildApp();
    const res = await request(app).delete("/api/user");

    expect(res.status).toBe(500);
    // Clerk account must NOT have been deleted (transaction rolled back)
    expect(mocks.clerkDeleteUser).not.toHaveBeenCalled();
  });
});
