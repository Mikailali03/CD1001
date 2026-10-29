import { Router } from "express";
import { timingSafeEqual } from "crypto";
import { runScheduledJobs } from "../lib/scheduler.js";

const router = Router();

function secretMatches(provided: unknown): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// For an external hourly cron (e.g. a Replit Scheduled Deployment) so reminders
// still go out when the autoscaled API has scaled to zero. Send the
// CRON_SECRET value in the x-cron-secret header.
router.post("/internal/run-scheduled-jobs", async (req, res) => {
  if (!secretMatches(req.headers["x-cron-secret"])) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await runScheduledJobs();
  res.json({ ok: true });
});

export default router;
