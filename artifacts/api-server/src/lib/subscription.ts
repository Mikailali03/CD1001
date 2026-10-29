import type { RequestHandler } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, TIER_RANK, type SubscriptionTier } from "@workspace/db";
import { and, eq, lt, ne, or, sql } from "drizzle-orm";

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

// Free-tier allowance per AI feature. Paid tiers are unlimited (but still
// subject to the per-user rate limit in aiRateLimit).
const FREE_AI_ALLOWANCE = 1;

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
// an unbounded OpenAI bill. In-memory, so it's per server instance — a cost
// backstop rather than an exact quota.
const AI_WINDOW_MS = 60 * 60 * 1000;
const AI_MAX_PER_WINDOW = 30;
const aiCalls = new Map<string, number[]>();

export function aiRateLimit(): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const recent = (aiCalls.get(req.userId) ?? []).filter((t) => now - t < AI_WINDOW_MS);
    if (recent.length >= AI_MAX_PER_WINDOW) {
      res.status(429).json({ error: "Too many AI requests. Please try again later." });
      return;
    }
    recent.push(now);
    aiCalls.set(req.userId, recent);
    next();
  };
}
