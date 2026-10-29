import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

// One row per completed scheduled-job run (e.g. "maintenance-reminders" for
// 2026-11-03). The composite key lets any number of server instances race to
// claim a run and guarantees only one of them actually performs it.
export const jobRunsTable = pgTable(
  "job_runs",
  {
    job: text("job").notNull(),
    runKey: text("run_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.job, t.runKey] })],
);
