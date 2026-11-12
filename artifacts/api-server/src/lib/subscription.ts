import type { RequestHandler } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, TIER_RANK, type SubscriptionTier } from "@workspace/db";
import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import { isDemoUser } from "./demo.js";
import { rateLimit, RATE_LIMITS } from "./rateLimit.js";
import { requireAi } from "../middlewares/requireAi.js";

export async function getOrCreateSubscription(userId: string) {
  // Insert-if-missing first so two concurrent first requests can't both try
  // to create the row and trip the unique constraint.
  await db.insert(subscriptionsTable).values({ userId, tier: "essential" }).onConflictDoNothing();
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  return sub!;
}

export function tierAtLeast(tier: SubscriptionTier | null | undefined, min: SubscriptionTier): boolean {
  return (TIER_RANK[tier ?? "essential"] ?? 0) >= (TIER_RANK[min] ?? 0);
}

/** Server-side paywall: 403 unless the signed-in user's plan is `min` or higher. */
export function requireTier(min: SubscriptionTier): RequestHandler {
  return async (req, res, next) => {
    // The read-only demo shows every Basic feature (e.g. Capital Outlook).
    if (isDemoUser(req.userId)) {
      next();
      return;
    }
    const [sub] = await db
      .select({ tier: subscriptionsTable.tier })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, req.userId))
      .limit(1);
    if (!tierAtLeast(sub?.tier, min)) {
      res.status(403).json({ error: "upgrade_required", requiredTier: min });
      return;
    }
    next();
  };
}

// Plans that can be bought right now. Managed and Concierge are hidden until
// their perks exist; existing subscribers keep them, and the webhook still syncs them.
export const PURCHASABLE_TIERS: readonly SubscriptionTier[] = ["basic"];

// Free-tier allowance per AI feature. Paid tiers are unlimited (but still
// subject to the per-user rate limit in aiRateLimit).
export const FREE_AI_ALLOWANCE = 5;

type AiFeature = "scans" | "plans";

/**
 * Atomically reserve one use of a metered AI feature *before* calling the
 * model. Returns false when a free-tier user has used their allowance. The
 * single conditional UPDATE means parallel requests can't both slip through.
 * Call refundAiUse if the AI call then fails.
 */
export async function reserveAiUse(userId: string, kind: AiFeature): Promise<boolean> {
  await getOrCreateSubscription(userId);
  const counter = kind === "scans" ? subscriptionsTable.aiScansUsed : subscriptionsTable.aiPlansUsed;
  const increment = sql`${counter} + 1`;
  const rows = await db
    .update(subscriptionsTable)
    .set(kind === "scans" ? { aiScansUsed: increment, updatedAt: new Date() } : { aiPlansUsed: increment, updatedAt: new Date() })
    .where(
      and(
        eq(subscriptionsTable.userId, userId),
        or(ne(subscriptionsTable.tier, "essential"), lt(counter, FREE_AI_ALLOWANCE)),
      ),
    )
    .returning({ id: subscriptionsTable.id });
  return rows.length > 0;
}

export async function refundAiUse(userId: string, kind: AiFeature): Promise<void> {
  const counter = kind === "scans" ? subscriptionsTable.aiScansUsed : subscriptionsTable.aiPlansUsed;
  const decrement = sql`greatest(${counter} - 1, 0)`;
  await db
    .update(subscriptionsTable)
    .set(kind === "scans" ? { aiScansUsed: decrement } : { aiPlansUsed: decrement })
    .where(eq(subscriptionsTable.userId, userId));
}

// Per-user cap on AI calls, independent of plan, so one account can't run up
// an unbounded OpenAI bill. Counted in Postgres, so it holds across instances.
// Also answers 503 up front when no OpenAI key is configured, before anything
// is counted or reserved.
export function aiRateLimit(): RequestHandler {
  const limiter = rateLimit({ ...RATE_LIMITS.ai, message: "Too many AI requests. Please try again later." });
  const ai = requireAi();
  return (req, res, next) => ai(req, res, () => limiter(req, res, next));
}
