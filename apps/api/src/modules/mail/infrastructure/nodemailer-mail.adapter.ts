import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";

import type { OutboundEmail } from "../domain/mail.port.js";

import { env } from "../../../config/env.js";
import { MailPort } from "../domain/mail.port.js";

const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 20_000;

@Injectable()
export class NodemailerMailAdapter extends MailPort {
  private readonly transporter = nodemailer.createTransport({
    auth: env.smtpUser === undefined ? undefined : { pass: env.smtpPass, user: env.smtpUser },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });

  async send({ attachments, html, subject, text, to }: OutboundEmail): Promise<void> {
    await this.transporter.sendMail({
      attachments,
      from: env.mailFrom,
      html,
      subject,
      text,
      to,
    });
  }
}
