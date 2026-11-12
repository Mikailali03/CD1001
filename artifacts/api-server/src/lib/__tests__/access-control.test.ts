/**
 * Who can see and change what: owner, accepted collaborator, invited
 * collaborator, stranger, admin and the read-only demo. The DB is faked with a
 * queue of query results, consumed in the order the code queries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const results: unknown[][] = [];
  const chain = (): Record<string, unknown> => {
    // Each query consumes one queued result, whether it ends at where() or
    // carries on to orderBy()/limit().
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.innerJoin = () => c;
    c.where = () => {
      const result = results.shift() ?? [];
      const done = () => Promise.resolve(result);
      return { then: (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) => done().then(ok, err), orderBy: done, limit: done };
    };
    return c;
  };
  const updates: { set: unknown }[] = [];
  const db = {
    select: vi.fn(() => chain()),
    update: vi.fn(() => ({
      set: (set: unknown) => {
        updates.push({ set });
        return { where: () => Promise.resolve() };
      },
    })),
  };
  return {
    db,
    results,
    updates,
    queue: (...r: unknown[][]) => { results.length = 0; results.push(...r); updates.length = 0; },
    getUser: vi.fn(),
    getAuth: vi.fn(() => ({ userId: null as string | null })),
    ensureDemoSeeded: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  propertiesTable: { __t: "properties" },
  assetsTable: { __t: "assets" },
  propertyCollaboratorsTable: { __t: "collaborators" },
  subscriptionsTable: { __t: "subscriptions" },
  serviceRecordsTable: { __t: "service_records" },
  auditLogTable: { __t: "audit_log" },
  TIER_RANK: { essential: 0, basic: 1, managed: 2, concierge: 3 },
}));
vi.mock("@clerk/express", () => ({
  getAuth: mocks.getAuth,
  clerkClient: { users: { getUser: mocks.getUser } },
}));
vi.mock("../demo.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../demo.js")>()),
  ensureDemoSeeded: mocks.ensureDemoSeeded,
}));
vi.mock("../logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../ensureProfile.js", () => ({ ensureProfile: vi.fn(() => Promise.resolve()) }));

const { getAccessibleProperty, getOwnedProperty, getAccessibleProperties } = await import("../access");

const HOME = { id: "p1", userId: "owner", address: "1 Elm St" };
const verifiedUser = (email: string) => ({
  primaryEmailAddressId: "e1",
  emailAddresses: [{ id: "e1", emailAddress: email, verification: { status: "verified" } }],
});

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.db.update.mockClear();
});

describe("getAccessibleProperty", () => {
  it("gives the owner access", async () => {
    mocks.queue([HOME]);
    expect(await getAccessibleProperty("p1", "owner")).toBe(HOME);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("gives an accepted collaborator access", async () => {
    mocks.queue([], [{ property: HOME }]);
    expect(await getAccessibleProperty("p1", "collab")).toBe(HOME);
  });

  it("accepts a pending invite addressed to the user's verified email on first access", async () => {
    mocks.getUser.mockResolvedValue(verifiedUser("Invitee@Example.com"));
    mocks.queue([], [], [{ property: HOME, collab: { id: "c1" } }]);
    expect(await getAccessibleProperty("p1", "invitee")).toBe(HOME);
    expect(mocks.updates).toEqual([{ set: { acceptedUserId: "invitee", status: "accepted" } }]);
  });

  it("ignores an invite when the user's email isn't verified", async () => {
    mocks.getUser.mockResolvedValue({
      primaryEmailAddressId: "e1",
      emailAddresses: [{ id: "e1", emailAddress: "invitee@example.com", verification: { status: "unverified" } }],
    });
    mocks.queue([], []);
    expect(await getAccessibleProperty("p1", "invitee")).toBeNull();
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("denies a stranger", async () => {
    mocks.getUser.mockResolvedValue(verifiedUser("stranger@example.com"));
    mocks.queue([], [], []);
    expect(await getAccessibleProperty("p1", "stranger")).toBeNull();
  });

  it("denies a stranger even if Clerk is unreachable", async () => {
    mocks.getUser.mockRejectedValue(new Error("network"));
    mocks.queue([], []);
    expect(await getAccessibleProperty("p1", "stranger")).toBeNull();
  });
});

describe("getOwnedProperty", () => {
  it("returns nothing for a collaborator (owner-only actions)", async () => {
    mocks.queue([]);
    expect(await getOwnedProperty("p1", "collab")).toBeNull();
  });
});

describe("getAccessibleProperties", () => {
  it("lists owned homes then shared ones, without duplicates", async () => {
    const shared = { id: "p2", userId: "someone" };
    mocks.queue([HOME], [{ property: HOME }, { property: shared }]);
    expect(await getAccessibleProperties("owner")).toEqual([HOME, shared]);
  });
});

describe("requireAuth", () => {
  type Res = { statusCode?: number; body?: unknown; status: (c: number) => Res; json: (b: unknown) => Res };
  const makeRes = (): Res => {
    const res: Res = {
      status(c) { res.statusCode = c; return res; },
      json(b) { res.body = b; return res; },
    };
    return res;
  };
  async function run(mw: (req: never, res: never, next: never) => void, req: Record<string, unknown>) {
    const res = makeRes();
    let nextCalled = false;
    await new Promise<void>((resolve) => {
      mw(req as never, res as never, (() => { nextCalled = true; resolve(); }) as never);
      setTimeout(resolve, 10);
    });
    return { res, nextCalled, req };
  }

  async function loadRequireAuth(token: string | undefined) {
    vi.resetModules();
    if (token === undefined) delete process.env.DEMO_TOKEN;
    else process.env.DEMO_TOKEN = token;
    return (await import("../../middlewares/requireAuth")).requireAuth();
  }

  it("lets the demo token read, as the demo user, after seeding the demo home", async () => {
    const mw = await loadRequireAuth("demo-secret");
    mocks.ensureDemoSeeded.mockClear();
    const { nextCalled, req } = await run(mw, { method: "GET", headers: { "x-demo-token": "demo-secret" } });
    expect(nextCalled).toBe(true);
    expect(req.userId).toBe("demo-user");
    expect(mocks.ensureDemoSeeded).toHaveBeenCalledOnce();
  });

  it.each(["POST", "PATCH", "DELETE"])("blocks demo %s requests (the demo is read-only)", async (method) => {
    const mw = await loadRequireAuth("demo-secret");
    const { nextCalled, res } = await run(mw, { method, headers: { "x-demo-token": "demo-secret" } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("ignores a wrong demo token and requires sign-in", async () => {
    const mw = await loadRequireAuth("demo-secret");
    mocks.getAuth.mockReturnValue({ userId: null });
    const { nextCalled, res } = await run(mw, { method: "GET", headers: { "x-demo-token": "guess" } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("turns demo mode off when DEMO_TOKEN isn't set", async () => {
    const mw = await loadRequireAuth(undefined);
    mocks.getAuth.mockReturnValue({ userId: null });
    const { res } = await run(mw, { method: "GET", headers: { "x-demo-token": "" } });
    expect(res.statusCode).toBe(401);
  });

  it("passes signed-in users through with their Clerk ID", async () => {
    const mw = await loadRequireAuth("demo-secret");
    mocks.getAuth.mockReturnValue({ userId: "user_1" });
    const { nextCalled, req } = await run(mw, { method: "POST", headers: {} });
    expect(nextCalled).toBe(true);
    expect(req.userId).toBe("user_1");
  });

  it("requireTier: free users get upgrade_required, Basic passes, the demo is unlocked", async () => {
    const { requireTier } = await import("../subscription");
    const mw = requireTier("basic");

    mocks.queue([{ tier: "essential" }]);
    let r = await run(mw, { userId: "free" });
    expect(r.res.statusCode).toBe(403);
    expect(r.res.body).toMatchObject({ error: "upgrade_required" });

    mocks.queue([{ tier: "basic" }]);
    r = await run(mw, { userId: "paid" });
    expect(r.nextCalled).toBe(true);

    mocks.queue();
    r = await run(mw, { userId: "demo-user" });
    expect(r.nextCalled).toBe(true);
  });
});

describe("service records", () => {
  it("can't be edited or deleted through the API once written", async () => {
    const { default: router } = await import("../../routes/service_records");
    const methods = (router as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack
      .flatMap((l) => (l.route ? Object.keys(l.route.methods).map((m) => `${m.toUpperCase()} ${l.route!.path}`) : []));
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.filter((m) => /^(PATCH|PUT|DELETE) /.test(m))).toEqual([]);
  });
});
