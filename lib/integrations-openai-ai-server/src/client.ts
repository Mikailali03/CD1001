import OpenAI from "openai";

/** Thrown when an AI feature is used but no OpenAI credentials are configured. */
export class AiUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super("AI features are unavailable: no OpenAI API key is configured");
    this.name = "AiUnavailableError";
  }
}

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
}

/**
 * Reads OpenAI credentials. Standard `OPENAI_API_KEY` / `OPENAI_BASE_URL` win;
 * the Replit AI Integrations variables are the fallback. Returns null when no
 * key is set, so the server can boot without AI and degrade gracefully.
 */
export function getOpenAIConfig(env: NodeJS.ProcessEnv = process.env): OpenAIConfig | null {
  const apiKey = env.OPENAI_API_KEY || env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = env.OPENAI_BASE_URL || env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
  return { apiKey, baseURL };
}

export function isAiConfigured(): boolean {
  return getOpenAIConfig() !== null;
}

let client: OpenAI | null = null;

/** The shared OpenAI client. Throws AiUnavailableError if no key is configured. */
export function getOpenAI(): OpenAI {
  if (client) return client;
  const config = getOpenAIConfig();
  if (!config) throw new AiUnavailableError();
  client = new OpenAI(config);
  return client;
}

/**
 * Lazily-created client, so importing this module never throws. Any use
 * without credentials throws AiUnavailableError.
 */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return Reflect.get(getOpenAI(), prop);
  },
});
