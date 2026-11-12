import { pgTable, text, timestamp, integer, primaryKey, index } from "drizzle-orm/pg-core";

// Fixed-window request counters shared by every API instance. One row per
// key (e.g. "ai:<userId>") and window; the count is bumped with an atomic
// upsert. Rows older than a day are pruned opportunistically.
export const rateLimitsTable = pgTable("rate_limits", {
  key: text("key").notNull(),
  windowStart: timestamp("window_start").notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.key, t.windowStart] }),
  index("rate_limits_window_start_idx").on(t.windowStart),
]);
