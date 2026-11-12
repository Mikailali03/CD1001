import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { propertiesTable, propertyCollaboratorsTable, userProfilesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { SetReminderSubscriptionBody, UpdateNotificationPreferencesBody } from "@workspace/api-zod";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { escapeHtml } from "../lib/email.js";
import { getAppUrl } from "../lib/appUrl.js";

const router = Router();
const PropertyParams = z.object({ propertyId: z.string() });

async function preferencesFor(userId: string) {
  const [profile] = await db
    .select({
      emailReminders: userProfilesTable.emailReminders,
      pushReminders: userProfilesTable.pushReminders,
      weeklySummary: userProfilesTable.weeklySummary,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  const shared = await db
    .select({
      propertyId: propertiesTable.id,
      name: propertiesTable.name,
      address: propertiesTable.address,
      receiveReminders: propertyCollaboratorsTable.receiveReminders,
    })
    .from(propertyCollaboratorsTable)
    .innerJoin(propertiesTable, eq(propertyCollaboratorsTable.propertyId, propertiesTable.id))
    .where(and(
      eq(propertyCollaboratorsTable.acceptedUserId, userId),
      eq(propertyCollaboratorsTable.status, "accepted"),
    ));
  return {
    emailReminders: profile?.emailReminders ?? true,
    pushReminders: profile?.pushReminders ?? true,
    weeklySummary: profile?.weeklySummary ?? true,
    sharedHomes: shared,
  };
}

router.get("/user/notification-preferences", requireAuth(), async (req, res) => {
  res.json(await preferencesFor(req.userId));
});

router.patch("/user/notification-preferences", requireAuth(), async (req, res) => {
  const body = UpdateNotificationPreferencesBody.parse(req.body);
  const updated = await db
    .update(userProfilesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(userProfilesTable.userId, req.userId))
    .returning({ userId: userProfilesTable.userId });
  if (updated.length === 0) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(await preferencesFor(req.userId));
});

router.put("/properties/:propertyId/reminder-subscription", requireAuth(), async (req, res) => {
  const { propertyId } = PropertyParams.parse(req.params);
  const { enabled } = SetReminderSubscriptionBody.parse(req.body);
  const updated = await db
    .update(propertyCollaboratorsTable)
    .set({ receiveReminders: enabled })
    .where(and(
      eq(propertyCollaboratorsTable.propertyId, propertyId),
      eq(propertyCollaboratorsTable.acceptedUserId, req.userId),
      eq(propertyCollaboratorsTable.status, "accepted"),
    ))
    .returning({ id: propertyCollaboratorsTable.id });
  if (updated.length === 0) {
    res.status(404).json({ error: "You're not a collaborator on this home" });
    return;
  }
  res.json(await preferencesFor(req.userId));
});

// ── One-click unsubscribe from reminder emails (no sign-in) ──────────────────
// GET is the link in the email footer; POST is what mail clients send for the
// List-Unsubscribe-Post header (RFC 8058). By default both turn off reminder
// emails and the weekly summary; with scope=weekly (the weekly summary's own
// link) only the weekly summary. Transfer, claim and report emails aren't
// affected.

type Scope = "reminders" | "weekly";

function scopeOf(value: unknown): Scope {
  return value === "weekly" ? "weekly" : "reminders";
}

async function unsubscribe(token: unknown, scope: Scope): Promise<boolean> {
  if (typeof token !== "string" || token.length < 10) return false;
  const change = scope === "weekly"
    ? { weeklySummary: false }
    : { emailReminders: false, weeklySummary: false };
  const rows = await db
    .update(userProfilesTable)
    .set({ ...change, updatedAt: new Date() })
    .where(eq(userProfilesTable.unsubscribeToken, token))
    .returning({ userId: userProfilesTable.userId });
  return rows.length > 0;
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #1a1a1a;">
<h1 style="font-size: 22px;">${escapeHtml(title)}</h1>${body}</body></html>`;
}

router.get("/email/unsubscribe", async (req: Request, res: Response) => {
  const scope = scopeOf(req.query.scope);
  const ok = await unsubscribe(req.query.token, scope);
  const settingsUrl = `${getAppUrl()}/settings`;
  res
    .status(ok ? 200 : 404)
    .type("html")
    .send(ok
      ? page("You're unsubscribed", `<p>${scope === "weekly"
        ? "You won't get the weekly summary email anymore. Maintenance reminders for upcoming and overdue tasks aren't affected."
        : "You won't get maintenance reminder emails or the weekly summary anymore."}</p>
<p>You can turn them back on any time in <a href="${escapeHtml(settingsUrl)}">Settings</a>.</p>`)
      : page("Link not recognised", `<p>This unsubscribe link isn't valid. You can manage email reminders in <a href="${escapeHtml(settingsUrl)}">Settings</a>.</p>`));
});

router.post("/email/unsubscribe", async (req: Request, res: Response) => {
  const ok = await unsubscribe(req.query.token, scopeOf(req.query.scope));
  res.status(ok ? 200 : 404).json({ ok });
});

export default router;
