import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger.js";

const connectors = new ReplitConnectors();
const DEFAULT_FROM = "Casa Dossier <no-reply@notifications.casadossier.com>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Use the connected Resend account; credentials stay in the connector proxy.
 * Fail explicitly rather than silently skipping messages when delivery fails.
 */
export async function sendEmail({ to, subject, html, text }: EmailMessage): Promise<void> {
  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [to],
      subject: subject.replace(/[\r\n]+/g, " "),
      html,
      ...(text ? { text } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 500)}`);
  }

  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("id" in result) ||
    typeof result.id !== "string" ||
    !result.id
  ) {
    throw new Error("Resend did not return an email delivery ID");
  }
  // Avoid logging recipients, subjects, or message bodies.
  logger.info({ emailId: result.id }, "Resend accepted transactional email");
}
