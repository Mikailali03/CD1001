import { db, emailTemplatesTable, emailTriggersTable, type TriggerEvent } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { getAppUrl } from "./appUrl.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Casa Dossier <noreply@casadossier.com>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a transactional email through Resend. A no-op (logged) when
 * RESEND_API_KEY isn't configured. Rejects on delivery failure, so callers on
 * a request path should fire and forget with `.catch(...)`.
 */
export async function sendEmail({ to, subject, html, text }: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.info({ to, subject }, "RESEND_API_KEY not set, skipping email");
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [to],
      // Subjects are plain text and must stay on one line.
      subject: subject.replace(/[\r\n]+/g, " "),
      html,
      ...(text ? { text } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 500)}`);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Replace `{{name}}` placeholders. Unknown placeholders render as empty. */
export function renderTemplate(
  template: string,
  variables: Record<string, string>,
  { escape }: { escape: boolean },
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => {
    const value = variables[name] ?? "";
    return escape ? escapeHtml(value) : value;
  });
}

/**
 * The admin-configured template for an event: the oldest active trigger for
 * that event that has a template linked. Null means use the built-in email.
 */
async function getTriggerTemplate(event: TriggerEvent) {
  const [row] = await db
    .select({ subject: emailTemplatesTable.subject, bodyHtml: emailTemplatesTable.bodyHtml })
    .from(emailTriggersTable)
    .innerJoin(emailTemplatesTable, eq(emailTriggersTable.templateId, emailTemplatesTable.id))
    .where(and(eq(emailTriggersTable.triggerEvent, event), eq(emailTriggersTable.isActive, true)))
    .orderBy(emailTriggersTable.createdAt)
    .limit(1);
  return row ?? null;
}

/**
 * Send the email for a Communication Hub event: the admin's template if an
 * active trigger links one, otherwise the built-in default.
 */
async function sendEventEmail(
  event: TriggerEvent,
  to: string,
  variables: Record<string, string>,
  fallback: Omit<EmailMessage, "to">,
): Promise<void> {
  const template = await getTriggerTemplate(event);
  if (!template) {
    await sendEmail({ to, ...fallback });
    return;
  }
  await sendEmail({
    to,
    subject: renderTemplate(template.subject, variables, { escape: false }),
    html: renderTemplate(template.bodyHtml, variables, { escape: true }),
  });
}

function formatAddress(property: { address: string; city?: string | null; state?: string | null }): string {
  return [property.address, property.city, property.state].filter(Boolean).join(", ");
}

function layout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
${bodyHtml}
  <p style="margin-top: 32px; color: #6b7280; font-size: 13px;">Casa Dossier — Your Home Maintenance OS</p>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">${escapeHtml(label)}</a>`;
}

type EmailProperty = { name: string; address: string; city?: string | null; state?: string | null };

/** Tell the recipient of a deed transfer how to claim the home's dossier. */
export async function sendTransferInitiatedEmail(params: {
  toEmail: string;
  senderEmail: string;
  property: EmailProperty;
  token: string;
  expiresAt: Date | null;
}): Promise<void> {
  const { toEmail, senderEmail, property, token, expiresAt } = params;
  const claimUrl = `${getAppUrl()}/claim/${token}`;
  const propertyAddress = formatAddress(property);
  const expiresOn = expiresAt
    ? expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  const variables = {
    firstName: "there",
    recipientEmail: toEmail,
    senderEmail,
    propertyName: property.name,
    propertyAddress,
    claimUrl,
    actionUrl: claimUrl,
    ctaUrl: claimUrl,
    expiresAt: expiresOn,
  };

  const e = escapeHtml;
  await sendEventEmail("property_transfer_initiated", toEmail, variables, {
    subject: `${senderEmail} is transferring ${property.name} to you on Casa Dossier`,
    html: layout(`  <h2>You've been sent a home dossier</h2>
  <p><strong>${e(senderEmail)}</strong> is transferring the Casa Dossier record for <strong>${e(property.name)}</strong>${propertyAddress ? ` (${e(propertyAddress)})` : ""} to you.</p>
  <p>Claiming it gives you the home's full maintenance history: equipment, service records, warranties and upcoming tasks.</p>
  ${button(claimUrl, "Claim this home")}
  ${expiresOn ? `<p style="color: #6b7280; font-size: 14px;">This link expires on ${e(expiresOn)}.</p>` : ""}
  <p style="color: #6b7280; font-size: 14px;">If you weren't expecting this, you can ignore this email.</p>`),
    text: [
      `${senderEmail} is transferring the Casa Dossier record for ${property.name}${propertyAddress ? ` (${propertyAddress})` : ""} to you.`,
      "",
      `Claim it here: ${claimUrl}`,
      ...(expiresOn ? ["", `This link expires on ${expiresOn}.`] : []),
      "",
      "If you weren't expecting this, you can ignore this email.",
    ].join("\n"),
  });
}

/** Invite someone to collaborate on a home. They accept from their inbox after signing in. */
export async function sendCollaboratorInviteEmail(params: {
  toEmail: string;
  inviterEmail: string | null;
  property: EmailProperty;
}): Promise<void> {
  const { toEmail, inviterEmail, property } = params;
  const actionUrl = `${getAppUrl()}/dashboard`;
  const propertyAddress = formatAddress(property);
  const inviter = inviterEmail ?? "A Casa Dossier homeowner";

  const variables = {
    firstName: "there",
    recipientEmail: toEmail,
    inviterEmail: inviterEmail ?? "",
    propertyName: property.name,
    propertyAddress,
    actionUrl,
    ctaUrl: actionUrl,
  };

  const e = escapeHtml;
  await sendEventEmail("collaborator_invited", toEmail, variables, {
    subject: `${inviter} invited you to ${property.name} on Casa Dossier`,
    html: layout(`  <h2>You're invited to collaborate</h2>
  <p><strong>${e(inviter)}</strong> invited you to help manage <strong>${e(property.name)}</strong>${propertyAddress ? ` (${e(propertyAddress)})` : ""} on Casa Dossier.</p>
  <p>Sign in or create an account with <strong>${e(toEmail)}</strong> to accept the invite and see the home's equipment, service history and maintenance schedule.</p>
  ${button(actionUrl, "Open Casa Dossier")}
  <p style="color: #6b7280; font-size: 14px;">If you weren't expecting this, you can ignore this email.</p>`),
    text: [
      `${inviter} invited you to help manage ${property.name}${propertyAddress ? ` (${propertyAddress})` : ""} on Casa Dossier.`,
      "",
      `Sign in or create an account with ${toEmail} to accept: ${actionUrl}`,
      "",
      "If you weren't expecting this, you can ignore this email.",
    ].join("\n"),
  });
}
