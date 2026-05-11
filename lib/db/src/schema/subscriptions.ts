import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const subscriptionTierEnum = pgEnum("subscription_tier", ["essential", "managed", "concierge"]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  tier: subscriptionTierEnum("tier").notNull().default("essential"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const TIER_PROPERTY_LIMITS: Record<string, number> = {
  essential: 1,
  managed: 5,
  concierge: 999,
};

export type SubscriptionTier = "essential" | "managed" | "concierge";
export type Subscription = typeof subscriptionsTable.$inferSelect;

export const UpgradeTierBody = z.object({
  tier: z.enum(["essential", "managed", "concierge"]),
});
