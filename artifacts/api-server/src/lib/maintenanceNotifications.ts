// Maintenance reminders by email and push. Runs on every scheduler tick and is
// idempotent: each reminder is claimed in notification_log before it's sent, so
// it goes out once per recipient and channel however often this runs.
//
//   due soon      once, when a task is 0–3 days from due
//   overdue       once at 1 day overdue, once more at 7; after that only the weekly summary
//   weekly        Monday, per user: due in the next 7 days, overdue, done last week
//
// Everything is sent at or after 8am in the home's own timezone.
import { db } from "@workspace/db";
import {
  assetsTable,
  maintenanceTasksTable,
  notificationLogTable,
  propertiesTable,
  propertyCollaboratorsTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { logger } from "./logger.js";
import { getVerifiedEmail } from "./access.js";
import { getAppUrl } from "./appUrl.js";
import { sendPushToUser } from "./pushNotifications.js";
import { escapeHtml, layout, button, sendEventEmail } from "./email.js";
import { addDays, daysBetween, localParts, timezoneForState } from "./timezones.js";

const SEND_HOUR = 8;
const MONDAY = 1;

type Kind = "due_soon" | "overdue_1" | "overdue_7";

type TaskRow = {
  taskId: string;
  title: string;
  nextDueDate: string;
  estimatedCost: string | null;
  isDiy: boolean;
  assetId: string;
  assetName: string;
  propertyId: string;
};

type Home = {
  id: string;
  name: string;
  address: string;
  state: string | null;
  ownerId: string;
  localDate: string;
  weekday: number;
};

type Recipient = {
  userId: string;
  firstName: string;
  emailReminders: boolean;
  pushReminders: boolean;
  weeklySummary: boolean;
  unsubscribeToken: string;
};

export function kindFor(daysUntilDue: number): Kind | null {
  if (daysUntilDue >= 0 && daysUntilDue <= 3) return "due_soon";
  if (daysUntilDue <= -1 && daysUntilDue >= -6) return "overdue_1";
  if (daysUntilDue <= -7 && daysUntilDue >= -13) return "overdue_7";
  return null;
}

/** Claim sends in notification_log; returns the keys this caller won. */
async function claim(keys: string[], channel: "email" | "push"): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db
    .insert(notificationLogTable)
    .values(keys.map((key) => ({ key, channel })))
    .onConflictDoNothing()
    .returning({ key: notificationLogTable.key });
  return new Set(rows.map((r) => r.key));
}

/** Release claims after a failed send, so the next tick retries. */
async function release(keys: string[], channel: "email" | "push"): Promise<void> {
  if (keys.length === 0) return;
  await db
    .delete(notificationLogTable)
    .where(and(inArray(notificationLogTable.key, keys), eq(notificationLogTable.channel, channel)));
}

/** Homes whose local time is past 8am, with the people who get their reminders. */
async function homesReadyToSend(now: Date) {
  const properties = await db
    .select({
      id: propertiesTable.id,
      name: propertiesTable.name,
      address: propertiesTable.address,
      state: propertiesTable.state,
      ownerId: propertiesTable.userId,
    })
    .from(propertiesTable)
    .where(isNotNull(propertiesTable.userId));

  const homes = new Map<string, Home>();
  for (const p of properties) {
    const local = localParts(now, timezoneForState(p.state));
    if (local.hour < SEND_HOUR) continue;
    homes.set(p.id, { ...p, ownerId: p.ownerId!, localDate: local.date, weekday: local.weekday });
  }
  if (homes.size === 0) return { homes, recipientsByHome: new Map<string, Recipient[]>() };

  const homeIds = [...homes.keys()];
  const optedIn = await db
    .select({ propertyId: propertyCollaboratorsTable.propertyId, userId: propertyCollaboratorsTable.acceptedUserId })
    .from(propertyCollaboratorsTable)
    .where(and(
      inArray(propertyCollaboratorsTable.propertyId, homeIds),
      eq(propertyCollaboratorsTable.status, "accepted"),
      eq(propertyCollaboratorsTable.receiveReminders, true),
    ));

  const userIds = new Set<string>([...homes.values()].map((h) => h.ownerId));
  for (const c of optedIn) if (c.userId) userIds.add(c.userId);
  const profiles = await db
    .select({
      userId: userProfilesTable.userId,
      firstName: userProfilesTable.firstName,
      emailReminders: userProfilesTable.emailReminders,
      pushReminders: userProfilesTable.pushReminders,
      weeklySummary: userProfilesTable.weeklySummary,
      unsubscribeToken: userProfilesTable.unsubscribeToken,
    })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.userId, [...userIds]));
  const profileById = new Map(profiles.map((p) => [p.userId, p]));

  const recipientsByHome = new Map<string, Recipient[]>();
  for (const home of homes.values()) {
    const ids = [home.ownerId, ...optedIn.filter((c) => c.propertyId === home.id).map((c) => c.userId!)];
    recipientsByHome.set(home.id, ids.map((id) => profileById.get(id)).filter((p): p is Recipient => !!p));
  }
  return { homes, recipientsByHome };
}

function money(value: string | null): string {
  const n = value != null ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "";
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function taskListHtml(tasks: TaskRow[], home: Home): string {
  const app = getAppUrl();
  const rows = tasks.map((t) => {
    const details = [`Due ${formatDate(t.nextDueDate)}`, money(t.estimatedCost) && `est. ${money(t.estimatedCost)}`, t.isDiy ? "DIY" : "Pro recommended"]
      .filter(Boolean)
      .join(" · ");
    const url = `${app}/properties/${home.id}/assets/${t.assetId}`;
    return `<tr><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
      <a href="${escapeHtml(url)}" style="color: #1a1a1a; font-weight: 600; text-decoration: none;">${escapeHtml(t.title)}</a>
      <div style="color: #6b7280; font-size: 13px;">${escapeHtml(t.assetName)} · ${escapeHtml(details)}</div>
    </td></tr>`;
  });
  return `<table style="width: 100%; border-collapse: collapse;">${rows.join("")}</table>`;
}

function taskListText(tasks: TaskRow[]): string {
  return tasks
    .map((t) => `- ${t.title} (${t.assetName}), due ${formatDate(t.nextDueDate)}${money(t.estimatedCost) ? `, est. ${money(t.estimatedCost)}` : ""}`)
    .join("\n");
}

type UnsubscribeScope = "reminders" | "weekly";

// "reminders" turns off reminder emails and the weekly summary; "weekly" (the
// link in the weekly summary) turns off only the weekly summary.
function unsubscribeUrl(recipient: Recipient, scope: UnsubscribeScope = "reminders"): string {
  const base = `${getAppUrl()}/api/email/unsubscribe?token=${encodeURIComponent(recipient.unsubscribeToken)}`;
  return scope === "weekly" ? `${base}&scope=weekly` : base;
}

function unsubscribeHeaders(recipient: Recipient, scope: UnsubscribeScope = "reminders"): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(recipient, scope)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function footer(recipient: Recipient, scope: UnsubscribeScope = "reminders"): string {
  const what = scope === "weekly"
    ? "the weekly summary is on for your Casa Dossier account"
    : "maintenance reminders are on for your Casa Dossier account";
  const link = scope === "weekly" ? "Unsubscribe from the weekly summary" : "Unsubscribe from reminder emails";
  return `<p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">You're getting this because ${what}.
  <a href="${escapeHtml(unsubscribeUrl(recipient, scope))}" style="color: #9ca3af;">${link}</a> or change it in Settings.</p>`;
}

async function sendReminderEmail(recipient: Recipient, email: string, home: Home, dueSoon: TaskRow[], overdue: TaskRow[]) {
  const appUrl = `${getAppUrl()}/properties/${home.id}`;
  const count = dueSoon.length + overdue.length;
  const subject = overdue.length > 0 && dueSoon.length === 0
    ? `${overdue.length === 1 ? `"${overdue[0]!.title}" is` : `${overdue.length} tasks are`} overdue at ${home.name}`
    : `${count === 1 ? `"${(dueSoon[0] ?? overdue[0])!.title}" is` : `${count} tasks are`} due soon at ${home.name}`;
  const sections = [
    dueSoon.length ? `<h3 style="margin: 20px 0 4px;">Due soon</h3>${taskListHtml(dueSoon, home)}` : "",
    overdue.length ? `<h3 style="margin: 20px 0 4px; color: #b91c1c;">Overdue</h3>${taskListHtml(overdue, home)}` : "",
  ].join("");
  const tasksHtml = sections;
  const text = [
    `Hi ${recipient.firstName},`,
    "",
    ...(dueSoon.length ? ["Due soon:", taskListText(dueSoon), ""] : []),
    ...(overdue.length ? ["Overdue:", taskListText(overdue), ""] : []),
    `Open Casa Dossier: ${appUrl}`,
    "",
    `Unsubscribe from reminder emails: ${unsubscribeUrl(recipient)}`,
  ].join("\n");

  await sendEventEmail(
    dueSoon.length ? "maintenance_due_soon" : "overdue_maintenance",
    email,
    {
      firstName: recipient.firstName,
      propertyName: home.name,
      propertyAddress: home.address,
      tasksHtml,
      actionUrl: appUrl,
      ctaUrl: appUrl,
      unsubscribeUrl: unsubscribeUrl(recipient),
    },
    {
      subject,
      html: layout(`  <h2 style="margin-bottom: 4px;">Hi ${escapeHtml(recipient.firstName)},</h2>
  <p style="margin-top: 0;">Here's what needs attention at <strong>${escapeHtml(home.name)}</strong>.</p>
  ${sections}
  <p style="margin-top: 24px;">${button(appUrl, "Open in Casa Dossier")}</p>
  ${footer(recipient)}`),
      text,
    },
    { rawVariables: new Set(["tasksHtml"]), headers: unsubscribeHeaders(recipient) },
  );
}

/** Due-soon and overdue reminders, one email and one push per recipient per home. */
async function sendTaskReminders(
  now: Date,
  homes: Map<string, Home>,
  recipientsByHome: Map<string, Recipient[]>,
  emailFor: (userId: string) => Promise<string | null>,
) {
  if (homes.size === 0) return;
  // Wide UTC window around every home's local "today"; kindFor() narrows it.
  const today = now.toISOString().slice(0, 10);
  const tasks: TaskRow[] = await db
    .select({
      taskId: maintenanceTasksTable.id,
      title: maintenanceTasksTable.title,
      nextDueDate: maintenanceTasksTable.nextDueDate,
      estimatedCost: maintenanceTasksTable.estimatedCost,
      isDiy: maintenanceTasksTable.isDiy,
      assetId: assetsTable.id,
      assetName: assetsTable.name,
      propertyId: assetsTable.propertyId,
    })
    .from(maintenanceTasksTable)
    .innerJoin(assetsTable, eq(maintenanceTasksTable.assetId, assetsTable.id))
    .where(and(
      inArray(assetsTable.propertyId, [...homes.keys()]),
      isNull(maintenanceTasksTable.completedAt),
      isNull(assetsTable.retiredAt),
      gte(maintenanceTasksTable.nextDueDate, addDays(today, -15)),
      lte(maintenanceTasksTable.nextDueDate, addDays(today, 5)),
    ));

  const byHome = new Map<string, { task: TaskRow; kind: Kind }[]>();
  for (const task of tasks) {
    const home = homes.get(task.propertyId)!;
    const kind = kindFor(daysBetween(home.localDate, task.nextDueDate));
    if (!kind) continue;
    const list = byHome.get(home.id) ?? [];
    list.push({ task, kind });
    byHome.set(home.id, list);
  }

  for (const [homeId, items] of byHome) {
    const home = homes.get(homeId)!;
    for (const recipient of recipientsByHome.get(homeId) ?? []) {
      const keyed = items.map((i) => ({ ...i, key: `task:${i.task.taskId}:${i.kind}:${recipient.userId}` }));

      if (recipient.emailReminders) {
        const email = await emailFor(recipient.userId);
        if (email) {
          const won = await claim(keyed.map((k) => k.key), "email");
          const mine = keyed.filter((k) => won.has(k.key));
          if (mine.length > 0) {
            try {
              await sendReminderEmail(
                recipient,
                email,
                home,
                mine.filter((k) => k.kind === "due_soon").map((k) => k.task),
                mine.filter((k) => k.kind !== "due_soon").map((k) => k.task),
              );
            } catch (err) {
              await release(mine.map((k) => k.key), "email");
              logger.error({ err, userId: recipient.userId, homeId }, "Reminder email failed");
            }
          }
        }
      }

      if (recipient.pushReminders) {
        const won = await claim(keyed.map((k) => k.key), "push");
        const mine = keyed.filter((k) => won.has(k.key));
        if (mine.length > 0) {
          const overdue = mine.filter((k) => k.kind !== "due_soon");
          const first = (overdue[0] ?? mine[0])!.task;
          const body = mine.length === 1
            ? `"${first.title}" ${overdue.length ? "is overdue" : "is due soon"}.`
            : `${mine.length} tasks need attention — including "${first.title}".`;
          try {
            await sendPushToUser(recipient.userId, {
              title: overdue.length ? "Maintenance Overdue" : "Maintenance Reminder",
              body,
              data: { screen: "maintenance", assetId: first.assetId, taskId: first.taskId },
            });
          } catch (err) {
            await release(mine.map((k) => k.key), "push");
            logger.error({ err, userId: recipient.userId, homeId }, "Reminder push failed");
          }
        }
      }
    }
  }
}

/** Monday summary per user across the homes they get reminders for. */
async function sendWeeklySummaries(
  now: Date,
  homes: Map<string, Home>,
  recipientsByHome: Map<string, Recipient[]>,
  emailFor: (userId: string) => Promise<string | null>,
) {
  // Homes where it's Monday morning, grouped by recipient.
  const homesByUser = new Map<string, { recipient: Recipient; homes: Home[] }>();
  for (const home of homes.values()) {
    if (home.weekday !== MONDAY) continue;
    for (const recipient of recipientsByHome.get(home.id) ?? []) {
      if (!recipient.weeklySummary) continue;
      const entry = homesByUser.get(recipient.userId) ?? { recipient, homes: [] };
      entry.homes.push(home);
      homesByUser.set(recipient.userId, entry);
    }
  }

  for (const { recipient, homes: userHomes } of homesByUser.values()) {
    const weekKey = `weekly:${recipient.userId}:${userHomes[0]!.localDate}`;
    const won = await claim([weekKey], "email");
    if (!won.has(weekKey)) continue;

    try {
      const email = await emailFor(recipient.userId);
      const homeIds = userHomes.map((h) => h.id);
      const localDate = userHomes[0]!.localDate;
      const tasks = await db
        .select({
          taskId: maintenanceTasksTable.id,
          title: maintenanceTasksTable.title,
          nextDueDate: maintenanceTasksTable.nextDueDate,
          estimatedCost: maintenanceTasksTable.estimatedCost,
          isDiy: maintenanceTasksTable.isDiy,
          completedAt: maintenanceTasksTable.completedAt,
          assetId: assetsTable.id,
          assetName: assetsTable.name,
          propertyId: assetsTable.propertyId,
        })
        .from(maintenanceTasksTable)
        .innerJoin(assetsTable, eq(maintenanceTasksTable.assetId, assetsTable.id))
        .where(and(inArray(assetsTable.propertyId, homeIds), isNull(assetsTable.retiredAt)));

      const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
      const sections: string[] = [];
      const textSections: string[] = [];
      for (const home of userHomes) {
        const mine = tasks.filter((t) => t.propertyId === home.id);
        const open = mine.filter((t) => !t.completedAt);
        const upcoming = open.filter((t) => t.nextDueDate >= localDate && t.nextDueDate <= addDays(localDate, 7));
        const overdue = open.filter((t) => t.nextDueDate < localDate);
        const done = mine.filter((t) => t.completedAt && t.completedAt >= weekAgo);
        if (!upcoming.length && !overdue.length && !done.length) continue;

        sections.push(`<h2 style="margin: 28px 0 4px;">${escapeHtml(home.name)}</h2>
          ${overdue.length ? `<h3 style="margin: 12px 0 4px; color: #b91c1c;">Overdue (${overdue.length})</h3>${taskListHtml(overdue, home)}` : ""}
          ${upcoming.length ? `<h3 style="margin: 12px 0 4px;">Due this week (${upcoming.length})</h3>${taskListHtml(upcoming, home)}` : ""}
          ${done.length ? `<p style="color: #047857; margin: 12px 0 0;">✓ ${done.length} task${done.length === 1 ? "" : "s"} completed last week</p>` : ""}`);
        textSections.push([
          home.name,
          ...(overdue.length ? ["Overdue:", taskListText(overdue)] : []),
          ...(upcoming.length ? ["Due this week:", taskListText(upcoming)] : []),
          ...(done.length ? [`${done.length} completed last week`] : []),
        ].join("\n"));
      }

      // Nothing to report: the claim stays, so this week isn't re-checked.
      if (!email || sections.length === 0) continue;

      const appUrl = `${getAppUrl()}/dashboard`;
      await sendEventEmail(
        "weekly_summary",
        email,
        {
          firstName: recipient.firstName,
          tasksHtml: sections.join(""),
          actionUrl: appUrl,
          ctaUrl: appUrl,
          unsubscribeUrl: unsubscribeUrl(recipient, "weekly"),
        },
        {
          subject: "Your home this week",
          html: layout(`  <p>Hi ${escapeHtml(recipient.firstName)}, here's your week in home maintenance.</p>
  ${sections.join("")}
  <p style="margin-top: 24px;">${button(appUrl, "Open Casa Dossier")}</p>
  ${footer(recipient, "weekly")}`),
          text: [`Hi ${recipient.firstName}, here's your week in home maintenance.`, "", ...textSections, "", appUrl, "", `Unsubscribe from the weekly summary: ${unsubscribeUrl(recipient, "weekly")}`].join("\n"),
        },
        { rawVariables: new Set(["tasksHtml"]), headers: unsubscribeHeaders(recipient, "weekly") },
      );
    } catch (err) {
      await release([weekKey], "email");
      logger.error({ err, userId: recipient.userId }, "Weekly summary failed");
    }
  }
}

export async function sendMaintenanceNotifications(now: Date = new Date()): Promise<void> {
  const { homes, recipientsByHome } = await homesReadyToSend(now);

  // Verified emails come from Clerk; look each person up at most once per run.
  const emails = new Map<string, Promise<string | null>>();
  const emailFor = (userId: string) => {
    if (!emails.has(userId)) emails.set(userId, getVerifiedEmail(userId));
    return emails.get(userId)!;
  };

  await sendTaskReminders(now, homes, recipientsByHome, emailFor);
  await sendWeeklySummaries(now, homes, recipientsByHome, emailFor);
}
