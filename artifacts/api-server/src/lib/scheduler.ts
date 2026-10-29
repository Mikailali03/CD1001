import { db, jobRunsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { sendMaintenanceReminders } from "./maintenanceReminders.js";
import { sendMonthlyTips } from "./monthlyTips.js";

// Schedules are expressed in this timezone rather than the server's (UTC on
// Replit), so "8am" means 8am for users. The marketplace launched in Atlanta.
const TIMEZONE = process.env.SCHEDULE_TIMEZONE || "America/New_York";

function localNow(): { date: string; month: string; day: number; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: `${parts.year}-${parts.month}`,
    day: Number(parts.day),
    hour: Number(parts.hour),
  };
}

/**
 * Run `fn` at most once per (job, runKey) across all server instances. The
 * claim is released if `fn` throws so the next tick can retry.
 */
async function runOnce(job: string, runKey: string, fn: () => Promise<void>): Promise<void> {
  const claimed = await db.insert(jobRunsTable).values({ job, runKey }).onConflictDoNothing().returning();
  if (claimed.length === 0) return;
  try {
    await fn();
    logger.info({ job, runKey }, "Scheduled job completed");
  } catch (err) {
    await db.delete(jobRunsTable).where(and(eq(jobRunsTable.job, job), eq(jobRunsTable.runKey, runKey)));
    throw err;
  }
}

/**
 * Idempotent: safe to call as often as you like (every few minutes from each
 * instance, and/or from an external cron hitting /api/internal/run-scheduled-jobs).
 * Uses "at or after" the target hour so a server that was asleep at 8am still
 * sends that day's reminders when it wakes.
 */
export async function runScheduledJobs(): Promise<void> {
  const now = localNow();
  if (now.hour >= 8) {
    await runOnce("maintenance-reminders", now.date, sendMaintenanceReminders);
  }
  // First few days of the month, so a sleeping server doesn't skip a month.
  if (now.day <= 3 && now.hour >= 9) {
    await runOnce("monthly-tips", now.month, sendMonthlyTips);
  }
}
