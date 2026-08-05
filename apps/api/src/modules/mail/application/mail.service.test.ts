import type { Mock } from "vitest";

import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMail: Mock = vi.fn();

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail })),
  },
}));

import { NodemailerMailAdapter } from "../infrastructure/nodemailer-mail.adapter.js";
import { MailService } from "./mail.service.js";

function getSentMail(): Record<string, unknown> {
  const [payload] = sendMail.mock.calls.at(-1) ?? [];
  if (payload === undefined) throw new Error("sendMail was not called");
  return payload as Record<string, unknown>;
}

describe("MailService.sendWelcomeEmail", () => {
  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: "test" });
  });

  it("sends the welcome email with the from, to, subject, html and text", async () => {
    const service = new MailService(new NodemailerMailAdapter());

    await service.sendWelcomeEmail({ to: "reader@example.com", userName: "Марина" });

    const mail = getSentMail();
    expect(mail.from).toBe("BookNest <no-reply@book-nest.net>");
    expect(mail.to).toBe("reader@example.com");
    expect(mail.subject).toBe("Вітаємо в BookNest ✨");
    expect(typeof mail.html).toBe("string");
    expect(typeof mail.text).toBe("string");
    expect(mail.html).toContain("Вітаємо, Марина ✨");
  });

  it("attaches the inline logo with the booknest-logo cid", async () => {
    const service = new MailService(new NodemailerMailAdapter());

    await service.sendWelcomeEmail({ to: "reader@example.com", userName: "Марина" });

    const mail = getSentMail();
    const attachments = mail.attachments as { cid: string; content: Buffer; filename: string }[];
    expect(attachments).toHaveLength(1);
    const [logo] = attachments;
    expect(logo?.cid).toBe("booknest-logo");
    expect(logo?.content.byteLength).toBeGreaterThan(0);
  });

  it("falls back to читачу when the user name is empty after trimming", async () => {
    const service = new MailService(new NodemailerMailAdapter());

    await service.sendWelcomeEmail({ to: "reader@example.com", userName: "   " });

    const mail = getSentMail();
    expect(mail.html).toContain("Вітаємо, читачу ✨");
  });

  it("resolves without throwing when the transport rejects", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    const service = new MailService(new NodemailerMailAdapter());

    await expect(
      service.sendWelcomeEmail({ to: "reader@example.com", userName: "Марина" }),
    ).resolves.toBeUndefined();
  });
});
