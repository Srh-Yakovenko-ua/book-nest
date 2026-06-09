import { Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";
import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../../../config/env.js";
import { createLogger } from "../../../core/logger.js";
import { renderEmailVerification } from "./templates/email-verification.js";
import { renderPasswordChanged } from "./templates/password-changed.js";
import { renderPasswordReset } from "./templates/password-reset.js";
import { renderWelcomeEmail } from "./templates/welcome-email.js";

type SendInput = {
  attachments?: { cid: string; content: Buffer; filename: string }[];
  html: string;
  subject: string;
  text: string;
  to: string;
};

const LOGO_CID = "booknest-logo";
const LOGO_FILENAME = "booknest-logo-horizontal.png";
const DEFAULT_USER_NAME = "читачу";

const logger = createLogger("mail");

@Injectable()
export class MailService {
  private readonly logoBuffer: Buffer;
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      auth: env.smtpUser === undefined ? undefined : { pass: env.smtpPass, user: env.smtpUser },
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
    });

    const logoPath = new URL("../assets/booknest-logo-horizontal.png", import.meta.url);
    this.logoBuffer = readFileSync(logoPath);
  }

  async sendPasswordChangedEmail({
    to,
    userName,
  }: {
    to: string;
    userName: string;
  }): Promise<void> {
    const safeUserName = userName.trim().length === 0 ? DEFAULT_USER_NAME : userName.trim();
    const loginUrl = `${env.webBaseUrl}/login`;
    const resetPasswordUrl = `${env.webBaseUrl}/forgot-password`;

    const { html, subject, text } = renderPasswordChanged({
      loginUrl,
      resetPasswordUrl,
      userName: safeUserName,
    });

    try {
      await this.send({ html, subject, text, to });
      logger.info({ to }, "password changed email sent");
    } catch (error) {
      logger.error({ error, to }, "failed to send password changed email");
    }
  }

  async sendPasswordResetEmail({
    resetPasswordUrl,
    to,
    userName,
  }: {
    resetPasswordUrl: string;
    to: string;
    userName: string;
  }): Promise<void> {
    const safeUserName = userName.trim().length === 0 ? DEFAULT_USER_NAME : userName.trim();
    const loginUrl = `${env.webBaseUrl}/login`;

    const { html, subject, text } = renderPasswordReset({
      loginUrl,
      resetPasswordUrl,
      userName: safeUserName,
    });

    try {
      await this.send({ html, subject, text, to });
      logger.info({ to }, "password reset email sent");
    } catch (error) {
      logger.error({ error, to }, "failed to send password reset email");
    }
  }

  async sendVerificationEmail({
    expiresInMinutes,
    to,
    userName,
    verificationUrl,
  }: {
    expiresInMinutes: number;
    to: string;
    userName: string;
    verificationUrl: string;
  }): Promise<void> {
    const safeUserName = userName.trim().length === 0 ? DEFAULT_USER_NAME : userName.trim();

    const { html, subject, text } = renderEmailVerification({
      expiresInMinutes,
      userName: safeUserName,
      verificationUrl,
    });

    try {
      await this.send({
        attachments: [{ cid: LOGO_CID, content: this.logoBuffer, filename: LOGO_FILENAME }],
        html,
        subject,
        text,
        to,
      });
      logger.info({ to }, "verification email sent");
    } catch (error) {
      logger.error({ error, to }, "failed to send verification email");
    }
  }

  async sendWelcomeEmail({ to, userName }: { to: string; userName: string }): Promise<void> {
    const safeUserName = userName.trim().length === 0 ? DEFAULT_USER_NAME : userName.trim();
    const dashboardUrl = `${env.webBaseUrl}/dashboard`;
    const addBookUrl = `${env.webBaseUrl}/books/create`;
    const settingsUrl = `${env.webBaseUrl}/settings`;

    const { html, subject, text } = renderWelcomeEmail({
      addBookUrl,
      dashboardUrl,
      settingsUrl,
      userName: safeUserName,
    });

    try {
      await this.send({
        attachments: [{ cid: LOGO_CID, content: this.logoBuffer, filename: LOGO_FILENAME }],
        html,
        subject,
        text,
        to,
      });
      logger.info({ to }, "welcome email sent");
    } catch (error) {
      logger.error({ error, to }, "failed to send welcome email");
    }
  }

  private async send({ attachments, html, subject, text, to }: SendInput): Promise<void> {
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
