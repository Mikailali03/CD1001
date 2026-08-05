import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function deliverMessages(messages: object[]): Promise<void> {
  if (!messages.length) return;

  // Expo push API accepts up to 100 messages per request
  const CHUNK = 100;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, "Expo push request failed");
      }
    } catch (err) {
      logger.error({ err }, "Failed to send push notification chunk");
    }
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const tokens = await db
    .select()
    .from(pushTokensTable)
    .where(eq(pushTokensTable.userId, userId));

  if (!tokens.length) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: "default",
  }));

  await deliverMessages(messages);
}

/** Broadcast a push notification to every registered user. */
export async function sendBroadcastPush(payload: PushPayload): Promise<number> {
  const tokens = await db.select().from(pushTokensTable);

  if (!tokens.length) return 0;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: "default",
  }));

  await deliverMessages(messages);
  logger.info({ count: tokens.length }, "Broadcast push sent");
  return tokens.length;
}
