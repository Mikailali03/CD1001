import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ info: vi.fn(), proxy: vi.fn() }));
vi.mock("../logger.js", () => ({ logger: { info: mocks.info } }));

const { sendEmail, selectTransport, buildPayload, setConnectorsClientForTests } = await import("../emailDelivery");

const SDK = "@replit/connectors-sdk";
const sdkInstalled = await import(SDK).then(() => true, () => false);

const ok = (body: unknown = { id: "email_123" }) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const MESSAGE = { to: "owner@example.com", subject: "Line one\r\nline two", html: "<p>Hi</p>" };
const ENV_KEYS = ["RESEND_API_KEY", "REPL_ID", "REPLIT_CONNECTORS_HOSTNAME", "EMAIL_FROM"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.clearAllMocks();
  setConnectorsClientForTests({ proxy: mocks.proxy });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
  setConnectorsClientForTests(null);
});

describe("selectTransport", () => {
  it("prefers a direct API key, then the Replit integration, else off", () => {
    expect(selectTransport({ RESEND_API_KEY: "re_x", REPL_ID: "r" })).toBe("direct");
    expect(selectTransport({ REPL_ID: "r" })).toBe("replit");
    expect(selectTransport({ REPLIT_CONNECTORS_HOSTNAME: "h" })).toBe("replit");
    expect(selectTransport({})).toBe("off");
  });
});

describe("buildPayload", () => {
  it("uses the notifications subdomain sender, one-line subjects, and omits empty extras", () => {
    expect(buildPayload(MESSAGE, {})).toEqual({
      from: "Casa Dossier <no-reply@notifications.casadossier.com>",
      to: ["owner@example.com"],
      subject: "Line one line two",
      html: "<p>Hi</p>",
    });
  });

  it("honours EMAIL_FROM and passes headers, reply-to and base64 attachments", () => {
    const payload = buildPayload(
      {
        ...MESSAGE,
        text: "Hi",
        headers: { "List-Unsubscribe": "<https://x/unsub>" },
        replyTo: "me@example.com",
        attachments: [{ filename: "report.pdf", content: Buffer.from("PDF") }],
      },
      { EMAIL_FROM: "Ops <ops@notifications.casadossier.com>" },
    );
    expect(payload).toMatchObject({
      from: "Ops <ops@notifications.casadossier.com>",
      text: "Hi",
      headers: { "List-Unsubscribe": "<https://x/unsub>" },
      reply_to: "me@example.com",
      attachments: [{ filename: "report.pdf", content: Buffer.from("PDF").toString("base64") }],
    });
  });
});

describe("sendEmail", () => {
  it("skips quietly, without logging the recipient, when email isn't configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail(MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.proxy).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.info.mock.calls)).not.toContain("owner@example.com");
  });

  it("calls Resend directly with the API key when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_secret";
    process.env.REPL_ID = "r";
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail(MESSAGE);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_secret");
    expect(mocks.proxy).not.toHaveBeenCalled();
  });

  it("goes through the Replit Resend integration on Replit without a key", async () => {
    process.env.REPL_ID = "r";
    mocks.proxy.mockResolvedValue(ok());
    await sendEmail({ ...MESSAGE, attachments: [{ filename: "a.pdf", content: Buffer.from("x") }] });
    expect(mocks.proxy).toHaveBeenCalledOnce();
    const [connector, path, init] = mocks.proxy.mock.calls[0]!;
    expect(connector).toBe("resend");
    expect(path).toBe("/emails");
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(init.body).attachments).toHaveLength(1);
  });

  it("logs only the delivery ID, never the recipient or subject", async () => {
    process.env.REPL_ID = "r";
    mocks.proxy.mockResolvedValue(ok());
    await sendEmail(MESSAGE);
    const logged = JSON.stringify(mocks.info.mock.calls);
    expect(logged).toContain("email_123");
    expect(logged).not.toContain("owner@example.com");
    expect(logged).not.toContain("Line one");
  });

  it("rejects when Resend refuses the message", async () => {
    process.env.REPL_ID = "r";
    mocks.proxy.mockResolvedValue(new Response("domain not verified", { status: 403 }));
    await expect(sendEmail(MESSAGE)).rejects.toThrow("Resend responded 403: domain not verified");
  });

  it("rejects a success response without a delivery ID", async () => {
    process.env.REPL_ID = "r";
    mocks.proxy.mockResolvedValue(ok({}));
    await expect(sendEmail(MESSAGE)).rejects.toThrow("did not return an email delivery ID");
  });

  it("propagates a connection failure", async () => {
    process.env.REPL_ID = "r";
    mocks.proxy.mockRejectedValue(new Error("connector offline"));
    await expect(sendEmail(MESSAGE)).rejects.toThrow("connector offline");
  });

  it.skipIf(sdkInstalled)("rejects clearly when the Replit SDK isn't installed, instead of crashing", async () => {
    process.env.REPL_ID = "r";
    setConnectorsClientForTests(null); // force a real load of the (missing) SDK
    await expect(sendEmail(MESSAGE)).rejects.toThrow(/Replit Resend integration unavailable/);
  });
});
