import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ proxy: vi.fn(), info: vi.fn() }));

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy = mocks.proxy;
  },
}));
vi.mock("../logger.js", () => ({ logger: { info: mocks.info } }));

import { sendEmail } from "../emailDelivery.js";

const message = {
  to: "recipient@example.com",
  subject: "Home invitation",
  html: "<p>You are invited</p>",
};

describe("connected Resend email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("EMAIL_FROM", undefined);
    mocks.proxy.mockImplementation(async () =>
      Response.json({ id: "test-delivery-id" }),
    );
  });

  afterEach(() => vi.unstubAllEnvs());

  it("uses the connected account and the selected sending subdomain", async () => {
    await sendEmail({ ...message, text: "You are invited" });

    expect(mocks.proxy).toHaveBeenCalledOnce();
    const [connector, path, options] = mocks.proxy.mock.calls[0]!;
    expect([connector, path]).toEqual(["resend", "/emails"]);
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body)).toEqual({
      from: "Casa Dossier <no-reply@notifications.casadossier.com>",
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: "You are invited",
    });
    expect(mocks.info).toHaveBeenCalledWith(
      { emailId: "test-delivery-id" },
      "Resend accepted transactional email",
    );
  });

  it("honors an explicitly configured From address", async () => {
    vi.stubEnv("EMAIL_FROM", "Casa Dossier Notifications <no-reply@notifications.casadossier.com>");
    await sendEmail(message);
    expect(JSON.parse(mocks.proxy.mock.calls[0]![2].body).from).toBe(
      "Casa Dossier Notifications <no-reply@notifications.casadossier.com>",
    );
  });

  it("strips subject line breaks and omits an absent text alternative", async () => {
    await sendEmail({ ...message, subject: "Invitation\r\nfor your home" });
    const payload = JSON.parse(mocks.proxy.mock.calls[0]![2].body);
    expect(payload.subject).toBe("Invitation for your home");
    expect(payload).not.toHaveProperty("text");
  });

  it("reports provider rejection instead of silently skipping", async () => {
    mocks.proxy.mockResolvedValue(new Response("Sender not verified", { status: 403 }));
    await expect(sendEmail(message)).rejects.toThrow("Resend responded 403: Sender not verified");
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("propagates a connection failure", async () => {
    mocks.proxy.mockRejectedValue(new Error("Connector unavailable"));
    await expect(sendEmail(message)).rejects.toThrow("Connector unavailable");
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("rejects a successful HTTP response without a delivery ID", async () => {
    mocks.proxy.mockResolvedValue(Response.json({}));
    await expect(sendEmail(message)).rejects.toThrow("Resend did not return an email delivery ID");
    expect(mocks.info).not.toHaveBeenCalled();
  });
});
