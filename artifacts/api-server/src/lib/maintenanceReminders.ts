import { db } from "@workspace/db";
import { maintenanceTasksTable, assetsTable, propertiesTable } from "@workspace/db";
import { eq, gte, lte, and, isNull } from "drizzle-orm";
import { sendPushToUser } from "./pushNotifications.js";
import { logger } from "./logger.js";

export async function sendMaintenanceReminders(): Promise<void> {
  const today = new Date().toISOString().split("T")[0]!;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 3);
  const threeDaysLater = cutoff.toISOString().split("T")[0]!;

  const rows = await db
    .select({
      taskId: maintenanceTasksTable.id,
      taskTitle: maintenanceTasksTable.title,
      nextDueDate: maintenanceTasksTable.nextDueDate,
      assetName: assetsTable.name,
      assetId: assetsTable.id,
      userId: propertiesTable.userId,
    })
    .from(maintenanceTasksTable)
    .innerJoin(assetsTable, eq(maintenanceTasksTable.assetId, assetsTable.id))
    .innerJoin(propertiesTable, eq(assetsTable.propertyId, propertiesTable.id))
    .where(
      and(
        gte(maintenanceTasksTable.nextDueDate, today),
        lte(maintenanceTasksTable.nextDueDate, threeDaysLater),
        isNull(maintenanceTasksTable.completedAt),
      )
    );

  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = byUser.get(row.userId) ?? [];
    bucket.push(row);
    byUser.set(row.userId, bucket);
  }

  for (const [userId, tasks] of byUser) {
    const count = tasks.length;
    const first = tasks[0]!;
    const body = count === 1
      ? `"${first.taskTitle}" is due within 3 days.`
      : `${count} tasks due soon — including "${first.taskTitle}".`;

    await sendPushToUser(userId, {
      title: "Maintenance Reminder",
      body,
      data: { screen: "maintenance", assetId: first.assetId, taskId: first.taskId },
    });

    logger.info({ userId, count }, "Sent maintenance reminder push");
  }
}
