import { pgTable, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const subscriptionTierEnum = pgEnum("subscription_tier", ["essential", "basic", "managed", "concierge"]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  tier: subscriptionTierEnum("tier").notNull().default("essential"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  aiScansUsed: integer("ai_scans_used").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const TIER_PROPERTY_LIMITS: Record<string, number> = {
  essential: 1,
  basic: 1,
  managed: 5,
  concierge: 999,
};

export const TIER_RANK: Record<string, number> = {
  essential: 0,
  basic: 1,
  managed: 2,
  concierge: 3,
};

export type SubscriptionTier = "essential" | "basic" | "managed" | "concierge";
export type Subscription = typeof subscriptionsTable.$inferSelect;

export const UpgradeTierBody = z.object({
  tier: z.enum(["essential", "basic", "managed", "concierge"]),
});
