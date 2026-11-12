import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = { existing: [] as unknown[], inserted: [] as unknown[] };
  const db = {
    select: vi.fn(() => ({ from: () => ({ where: () => Promise.resolve(state.existing) }) })),
    insert: vi.fn(() => ({
      values: (v: unknown) => {
        state.inserted.push(v);
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    })),
  };
  return { state, db, getUser: vi.fn() };
});

vi.mock("@workspace/db", () => ({ db: mocks.db, userProfilesTable: { userId: "user_id" } }));
vi.mock("@clerk/express", () => ({ clerkClient: { users: { getUser: mocks.getUser } } }));
vi.mock("../logger.js", () => ({ logger: { warn: vi.fn() } }));

const { ensureProfile, resetEnsureProfileCache } = await import("../ensureProfile");

const clerkUser = {
  firstName: " Ana ",
  lastName: "Ruiz",
  primaryEmailAddressId: "e2",
  emailAddresses: [
    { id: "e1", emailAddress: "old@example.com" },
    { id: "e2", emailAddress: "ana@example.com" },
  ],
};

describe("ensureProfile", () => {
  beforeEach(() => {
    resetEnsureProfileCache();
    mocks.state.existing = [];
    mocks.state.inserted = [];
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue(clerkUser);
  });

  it("creates a homeowner profile from Clerk for a user without one", async () => {
    await ensureProfile("user_1");
    expect(mocks.state.inserted).toEqual([
      { userId: "user_1", firstName: "Ana", lastName: "Ruiz", email: "ana@example.com", role: "homeowner" },
    ]);
  });

  it("leaves an existing profile alone and doesn't call Clerk", async () => {
    mocks.state.existing = [{ userId: "user_1" }];
    await ensureProfile("user_1");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.state.inserted).toHaveLength(0);
  });

  it("checks each user only once per process, even with concurrent requests", async () => {
    await Promise.all([ensureProfile("user_1"), ensureProfile("user_1")]);
    await ensureProfile("user_1");
    expect(mocks.db.select).toHaveBeenCalledOnce();
  });

  it("falls back to 'User' when Clerk has no first name", async () => {
    mocks.getUser.mockResolvedValue({ ...clerkUser, firstName: null, lastName: null });
    await ensureProfile("user_2");
    expect(mocks.state.inserted[0]).toMatchObject({ firstName: "User", lastName: "" });
  });

  it("doesn't throw when Clerk fails, and retries on the next request", async () => {
    mocks.getUser.mockRejectedValueOnce(new Error("clerk down"));
    await expect(ensureProfile("user_3")).resolves.toBeUndefined();
    expect(mocks.state.inserted).toHaveLength(0);
    await ensureProfile("user_3");
    expect(mocks.state.inserted).toHaveLength(1);
  });
});
