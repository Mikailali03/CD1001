import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapUserProfiles } from "./lib/bootstrapUserProfiles";
import { sendMaintenanceReminders } from "./lib/maintenanceReminders.js";
import { sendMonthlyTips } from "./lib/monthlyTips.js";

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

  // Maintenance reminder cron — runs every hour, sends push at 8am
  setInterval(() => {
    const hour = new Date().getHours();
    if (hour === 8) {
      sendMaintenanceReminders().catch((err) =>
        logger.error({ err }, "Maintenance reminders failed"),
      );
    }
  }, 60 * 60 * 1000);

  // Monthly tips cron — runs every 24h, fires on the 1st of the month at 9am
  setInterval(() => {
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() === 9) {
      sendMonthlyTips().catch((err) =>
        logger.error({ err }, "Monthly tips failed"),
      );
    }
  }, 60 * 60 * 1000);
});
