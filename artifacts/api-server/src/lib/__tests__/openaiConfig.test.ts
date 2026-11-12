import { describe, it, expect } from "vitest";
import { getOpenAIConfig } from "@workspace/integrations-openai-ai-server";

describe("getOpenAIConfig", () => {
  it("prefers the standard OpenAI variables", () => {
    expect(
      getOpenAIConfig({
        OPENAI_API_KEY: "sk-std",
        OPENAI_BASE_URL: "https://std",
        AI_INTEGRATIONS_OPENAI_API_KEY: "sk-replit",
        AI_INTEGRATIONS_OPENAI_BASE_URL: "https://replit",
      }),
    ).toEqual({ apiKey: "sk-std", baseURL: "https://std" });
  });

  it("falls back to the Replit AI Integrations variables", () => {
    expect(
      getOpenAIConfig({ AI_INTEGRATIONS_OPENAI_API_KEY: "sk-replit", AI_INTEGRATIONS_OPENAI_BASE_URL: "https://replit" }),
    ).toEqual({ apiKey: "sk-replit", baseURL: "https://replit" });
  });

  it("uses OpenAI's default endpoint when only a key is set", () => {
    expect(getOpenAIConfig({ OPENAI_API_KEY: "sk" })).toEqual({ apiKey: "sk", baseURL: undefined });
  });

  it("returns null without a key, so the server still boots", () => {
    expect(getOpenAIConfig({ OPENAI_BASE_URL: "https://x" })).toBeNull();
  });
});
