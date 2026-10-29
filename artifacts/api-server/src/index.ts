import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapUserProfiles } from "./lib/bootstrapUserProfiles";
import { runScheduledJobs } from "./lib/scheduler.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  bootstrapUserProfiles().catch((err) =>
    logger.error({ err }, "bootstrapUserProfiles failed"),
  );

  // Reminders and monthly tips. runScheduledJobs is idempotent across
  // instances, so every instance can tick; on autoscale (which can sleep),
  // also point an external hourly cron at POST /api/internal/run-scheduled-jobs.
  const tick = () =>
    runScheduledJobs().catch((err) => logger.error({ err }, "Scheduled jobs failed"));
  tick();
  setInterval(tick, 15 * 60 * 1000);
});
