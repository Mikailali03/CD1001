import { pgTable, index, text, timestamp } from "drizzle-orm/pg-core";

export const pushTokensTable = pgTable("push_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  platform: text("platform"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("push_tokens_user_id_idx").on(t.userId),
]);

export type PushToken = typeof pushTokensTable.$inferSelect;
