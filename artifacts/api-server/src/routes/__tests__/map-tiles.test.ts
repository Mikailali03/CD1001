import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../middlewares/requireAuth.js", () => ({
  requireAuth: () => (req: any, res: any, next: any) => {
    if (req.get("x-test-auth") !== "yes") {
      res.status(401).end();
      return;
    }
    req.userId = "test-user";
    next();
  },
}));

import router from "../map-tiles.js";

const app = express();
app.use((req, _res, next) => {
  req.log = { warn: vi.fn() } as any;
  next();
});
app.use("/api", router);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CARTO map tile proxy", () => {
  it("requires a signed-in session", async () => {
    expect((await request(app).get("/api/maps/tiles/10/271/409")).status).toBe(401);
  });

  it.each(["7/1/1", "19/1/1", "10/-1/1", "10/1024/0", "10/1/1024", "no/1/1", "10/1.5/1"])(
    "rejects invalid coordinates %s without contacting CARTO",
    async (coords) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await request(app).get(`/api/maps/tiles/${coords}`).set("x-test-auth", "yes");
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("fails explicitly when no key is configured", async () => {
    vi.stubEnv("CARTO_API_KEY", "");
    const res = await request(app).get("/api/maps/tiles/10/271/409").set("x-test-auth", "yes");
    expect(res.status).toBe(503);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("uses the server-only key and returns privately cached PNG bytes", async () => {
    vi.stubEnv("CARTO_API_KEY", "test-secret-not-a-real-key");
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(bytes, { headers: { "content-type": "image/png" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await request(app).get("/api/maps/tiles/10/271/409")
      .set("x-test-auth", "yes").set("Referer", "https://example.test/tech/map");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(bytes);
    expect(res.headers["cache-control"]).toBe("private, max-age=3600");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.origin).toBe("https://basemaps.cartocdn.com");
    expect(url.pathname).toBe("/light_all/10/271/409.png");
    expect(url.searchParams.get("key")).toBe("test-secret-not-a-real-key");
    expect(options.headers.Referer).toBe("https://example.test/tech/map");
    expect(JSON.stringify(res.headers)).not.toContain("test-secret");
  });

  it.each([403, 429, 500])("hides upstream error bodies (%s)", async (status) => {
    vi.stubEnv("CARTO_API_KEY", "test-secret-not-a-real-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("sensitive upstream details", { status })));
    const res = await request(app).get("/api/maps/tiles/10/271/409").set("x-test-auth", "yes");
    expect(res.status).toBe(502);
    expect(res.text).not.toContain("sensitive");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("handles timeouts without exposing the credential-bearing URL", async () => {
    vi.stubEnv("CARTO_API_KEY", "test-secret-not-a-real-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("URL with secret")));
    const res = await request(app).get("/api/maps/tiles/10/271/409").set("x-test-auth", "yes");
    expect(res.status).toBe(502);
    expect(res.text).not.toContain("secret");
  });
});
