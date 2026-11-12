import { Router, type IRouter } from "express";
import { GetMapTileParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { rateLimit, RATE_LIMITS } from "../lib/rateLimit.js";

const router: IRouter = Router();

// Leaflet's same-origin image requests carry the user's session cookie.
// Never return the upstream URL, error body, or key to the browser/logs.
router.get(
  "/maps/tiles/:z/:x/:y",
  requireAuth(),
  rateLimit({ ...RATE_LIMITS.mapTiles, message: "Too many map requests. Please try again later." }),
  async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = GetMapTileParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tile coordinates" });
    return;
  }
  const { z, x, y } = parsed.data;
  if (![z, x, y].every(Number.isInteger) || x >= 2 ** z || y >= 2 ** z) {
    res.status(400).json({ error: "Invalid tile coordinates" });
    return;
  }
  const key = process.env.CARTO_API_KEY;
  if (!key) {
    res.status(503).json({ error: "Map service is not configured" });
    return;
  }
  const url = new URL(`https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`);
  url.searchParams.set("key", key);
  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
      // Preserve the browser's referrer for CARTO keys with website restrictions.
      headers: req.get("referer") ? { Referer: req.get("referer")! } : {},
    });
    if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/png")) {
      req.log.warn({ status: upstream.status }, "Map tile provider rejected request");
      res.status(502).json({ error: "Map service is unavailable" });
      return;
    }
    const tile = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Vary", "Cookie, Authorization");
    res.type("png").send(tile);
  } catch {
    // Fetch exceptions may contain the credential-bearing URL.
    req.log.warn("Map tile request failed");
    res.status(502).json({ error: "Map service is unavailable" });
  }
});

export default router;
