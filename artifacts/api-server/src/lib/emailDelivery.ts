import { logger } from "./logger.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Casa Dossier <no-reply@notifications.casadossier.com>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Extra headers, e.g. List-Unsubscribe on reminder emails. */
  headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer }[];
  replyTo?: string;
}

// ── Transports ───────────────────────────────────────────────────────────────
// 1. RESEND_API_KEY set: call Resend directly (works anywhere).
// 2. Running on Replit without a key: go through the Replit Resend integration,
//    which keeps the credential in Replit's connector proxy.
// 3. Neither: email is off; sends are skipped (logged, without recipients).

type Transport = "direct" | "replit" | "off";

export function selectTransport(env: NodeJS.ProcessEnv = process.env): Transport {
  if (env.RESEND_API_KEY) return "direct";
  if (env.REPL_ID || env.REPLIT_CONNECTORS_HOSTNAME) return "replit";
  return "off";
}

interface ReplitConnectorsClient {
  proxy(connector: string, path: string, init: RequestInit): Promise<Response>;
}

// The SDK is only installed for, and only works on, Replit. It's loaded on
// first use, through a non-literal specifier so the bundler and type checker
// don't require it elsewhere and a missing package can't crash startup.
let connectors: Promise<ReplitConnectorsClient> | null = null;
const CONNECTORS_SDK = "@replit/connectors-sdk";

/** Test hook: replace the connector client. */
export function setConnectorsClientForTests(client: ReplitConnectorsClient | null): void {
  connectors = client ? Promise.resolve(client) : null;
}

function replitConnectors(): Promise<ReplitConnectorsClient> {
  connectors ??= (import(CONNECTORS_SDK) as Promise<{ ReplitConnectors: new () => ReplitConnectorsClient }>)
    .then(({ ReplitConnectors }) => new ReplitConnectors())
    .catch((err) => {
      connectors = null; // retry on the next send
      throw new Error(`Replit Resend integration unavailable: ${(err as Error).message}`);
    });
  return connectors;
}

export function buildPayload(
  { to, subject, html, text, headers, attachments, replyTo }: EmailMessage,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  return {
    from: env.EMAIL_FROM || DEFAULT_FROM,
    to: [to],
    // Subjects are plain text and must stay on one line.
    subject: subject.replace(/[\r\n]+/g, " "),
    html,
    ...(text ? { text } : {}),
    ...(headers && Object.keys(headers).length ? { headers } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(attachments?.length
      ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) }
      : {}),
  };
}

/**
 * Send a transactional email through Resend. A logged no-op when email isn't
 * configured. Rejects on delivery failure, so callers on a request path should
 * fire and forget with `.catch(...)`. Recipients, subjects and bodies are
 * never logged.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const transport = selectTransport();
  if (transport === "off") {
    logger.info("Email not configured (no RESEND_API_KEY or Replit integration); skipping send");
    return;
  }

  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(message)),
    signal: AbortSignal.timeout(15_000),
  };

  const response = transport === "direct"
    ? await fetch(RESEND_ENDPOINT, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      })
    : await (await replitConnectors()).proxy("resend", "/emails", init);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 500)}`);
  }

  const result: unknown = await response.json().catch(() => null);
  const id = result && typeof result === "object" && "id" in result ? (result as { id: unknown }).id : null;
  if (typeof id !== "string" || !id) {
    throw new Error("Resend did not return an email delivery ID");
  }
  logger.info({ emailId: id, transport }, "Resend accepted transactional email");
}
