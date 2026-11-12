// Postgres-backed fixed-window rate limiting, shared across API instances
// (the API autoscales, so in-memory counters would be per instance).
import type { Request, RequestHandler } from "express";
import { db, rateLimitsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";
import { logger } from "./logger.js";

export interface RateLimitRule {
  /** Namespace for the counter, e.g. "ai" or "rentcast:lookup". */
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  /** Seconds until the current window ends. */
  retryAfterSec: number;
}

/** Start of the fixed window containing `nowMs`. */
export function windowStart(nowMs: number, windowMs: number): Date {
  return new Date(Math.floor(nowMs / windowMs) * windowMs);
}

/** Pure decision for a counter value after incrementing. */
export function evaluate(count: number, rule: RateLimitRule, nowMs: number): RateLimitResult {
  const end = windowStart(nowMs, rule.windowMs).getTime() + rule.windowMs;
  return {
    allowed: count <= rule.limit,
    count,
    retryAfterSec: Math.max(1, Math.ceil((end - nowMs) / 1000)),
  };
}

const PRUNE_PROBABILITY = 0.01;
const PRUNE_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Counts one hit against `rule` for `subject` and says whether it's allowed.
 * The single INSERT ... ON CONFLICT DO UPDATE is atomic, so concurrent
 * requests on different instances can't both slip under the limit.
 */
export async function hitRateLimit(
  rule: RateLimitRule,
  subject: string,
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const key = `${rule.name}:${subject}`;
  const start = windowStart(nowMs, rule.windowMs);
  const [row] = await db
    .insert(rateLimitsTable)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitsTable.key, rateLimitsTable.windowStart],
      set: { count: sql`${rateLimitsTable.count} + 1` },
    })
    .returning({ count: rateLimitsTable.count });

  if (Math.random() < PRUNE_PROBABILITY) {
    db.delete(rateLimitsTable)
      .where(lt(rateLimitsTable.windowStart, new Date(nowMs - PRUNE_AGE_MS)))
      .catch((err) => logger.warn({ err }, "Rate limit pruning failed"));
  }

  return evaluate(row.count, rule, nowMs);
}

/**
 * Express middleware. `subject` defaults to the signed-in user. If the
 * database check itself fails the request is let through (and logged): the
 * limits are cost backstops, and a DB outage would fail the route anyway.
 */
export function rateLimit(
  rule: RateLimitRule & { message?: string; subject?: (req: Request) => string },
): RequestHandler {
  return async (req, res, next) => {
    const subject = rule.subject ? rule.subject(req) : req.userId;
    let result: RateLimitResult;
    try {
      result = await hitRateLimit(rule, subject);
    } catch (err) {
      req.log.error({ err, rule: rule.name }, "Rate limit check failed; allowing request");
      next();
      return;
    }
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSec));
      res.status(429).json({ error: rule.message ?? "Too many requests. Please try again later." });
      return;
    }
    next();
  };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Limits used across the API, in one place. */
export const RATE_LIMITS = {
  /** Every AI call (scan, plan, scout), per user, regardless of plan. */
  ai: { name: "ai", limit: 30, windowMs: HOUR },
  /** Whole-home scout plan, per user (on top of the AI limit). */
  scout: { name: "scout", limit: 10, windowMs: HOUR },
  /** RentCast address autocomplete (debounced as-you-type), per user. */
  rentcastAutocomplete: { name: "rentcast:autocomplete", limit: 120, windowMs: HOUR },
  /** RentCast full property lookup, per user. */
  rentcastLookup: { name: "rentcast:lookup", limit: 20, windowMs: HOUR },
  /**
   * Tech portal map tiles proxied with the server's CARTO key, per user. A
   * screenful is ~20-40 tiles and the browser caches them for an hour, so this
   * only stops scripted scraping of the key's quota.
   */
  mapTiles: { name: "map:tiles", limit: 3000, windowMs: HOUR },
  /** All user-triggered RentCast calls across the app, per day. */
  rentcastGlobal: {
    name: "rentcast:global",
    limit: Number(process.env.RENTCAST_DAILY_LIMIT) || 1000,
    windowMs: DAY,
  },
} satisfies Record<string, RateLimitRule>;
