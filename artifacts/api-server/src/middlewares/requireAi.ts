import type { RequestHandler } from "express";
import { isAiConfigured } from "@workspace/integrations-openai-ai-server";

export const AI_UNAVAILABLE_MESSAGE = "AI features are unavailable right now.";

/**
 * Rejects AI routes with 503 when no OpenAI key is configured. Put it before
 * rate limiting and allowance reservation, so nothing is consumed for a call
 * that can't happen.
 */
export function requireAi(): RequestHandler {
  return (_req, res, next) => {
    if (!isAiConfigured()) {
      res.status(503).json({ error: AI_UNAVAILABLE_MESSAGE });
      return;
    }
    next();
  };
}
