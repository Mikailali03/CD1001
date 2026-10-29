import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guideDifficultyEnum = ["easy", "medium", "hard"] as const;

export const guidesTable = pgTable("guides", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  difficulty: text("difficulty").notNull().$type<typeof guideDifficultyEnum[number]>(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  toolsNeeded: text("tools_needed"),
  steps: text("steps"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGuideSchema = createInsertSchema(guidesTable, {
  difficulty: z.enum(guideDifficultyEnum),
}).omit({ id: true, createdAt: true });
export type InsertGuide = z.infer<typeof insertGuideSchema>;
export type Guide = typeof guidesTable.$inferSelect;
