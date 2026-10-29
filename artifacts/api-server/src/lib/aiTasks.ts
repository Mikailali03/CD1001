import { z } from "zod";

// Model output is untrusted: coerce it into sane task rows and drop anything
// malformed rather than writing whatever came back straight into the DB.
const AiTask = z.object({
  title: z.string().trim().min(1).transform((s) => s.slice(0, 120)),
  description: z.string().nullish().transform((s) => (s ?? "").slice(0, 2000)),
  howTo: z.string().nullish().transform((s) => (s ? s.slice(0, 4000) : null)),
  intervalDays: z.coerce.number().int().transform((n) => Math.min(Math.max(n, 7), 3650)),
  isDiy: z.boolean().catch(true),
  estimatedCost: z.coerce.number().nonnegative().max(1_000_000).nullable().catch(null),
});

export type AiTask = z.infer<typeof AiTask>;

const MAX_TASKS = 15;

/** Parse a model reply that should be a JSON array of tasks. Returns null if it isn't one. */
export function parseAiTasks(raw: string): AiTask[] | null {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed
    .flatMap((t) => {
      const r = AiTask.safeParse(t);
      return r.success ? [r.data] : [];
    })
    .slice(0, MAX_TASKS);
}
