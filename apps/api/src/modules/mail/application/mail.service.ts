import type { InterfaceLanguage, NotificationPayload } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";

import { env } from "../../../config/env.js";
import { createLogger } from "../../../core/logger.js";
import { MailPort } from "../domain/mail.port.js";
import { maskEmail } from "../domain/mask-email.js";
import { renderEmailVerification } from "./templates/email-verification.js";
import { renderNotificationDigest } from "./templates/notification-digest.js";
import { renderPasswordChanged } from "./templates/password-changed.js";
import { renderPasswordReset } from "./templates/password-reset.js";
import { renderWelcomeEmail } from "./templates/welcome-email.js";

const LOGO_CID = "booknest-logo";
const LOGO_FILENAME = "booknest-logo-horizontal.png";
const DEFAULT_USER_NAME = "читачу";

const logger = createLogger("mail");

@Injectable()
export class MailService {
  private readonly logoBuffer: Buffer;

  constructor(private readonly mail: MailPort) {
    const logoPath = new URL("../assets/booknest-logo-horizontal.png", import.meta.url);
    this.logoBuffer = readFileSync(logoPath);
  }

  async sendNotificationDigestEmailOrThrow({
    items,
    locale,
    to,
    userName,
  }: {
    items: readonly NotificationPayload[];
    locale: InterfaceLanguage;
    to: string;
    userName: string;
  }): Promise<void> {
    const safeUserName = userName.trim().length === 0 ? DEFAULT_USER_NAME : userName.trim();
    const dashboardUrl = `${env.webBaseUrl}/dashboard`;

    const { html, subject, text } = renderNotificationDigest({
      dashboardUrl,
      items,
      locale,
      userName: safeUserName,
    });

    await this.mail.send({
      attachments: [{ cid: LOGO_CID, content: this.logoBuffer, filename: LOGO_FILENAME }],
      html,
      subject,
      text,
      to,
    });
    logger.info({ itemCount: items.length, to: maskEmail(to) }, "notification digest email sent");
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
      await this.mail.send({ html, subject, text, to });
      logger.info({ to: maskEmail(to) }, "password changed email sent");
    } catch (error) {
      logger.error({ error, to: maskEmail(to) }, "failed to send password changed email");
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
      await this.mail.send({ html, subject, text, to });
      logger.info({ to: maskEmail(to) }, "password reset email sent");
    } catch (error) {
      logger.error({ error, to: maskEmail(to) }, "failed to send password reset email");
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
      await this.mail.send({
        attachments: [{ cid: LOGO_CID, content: this.logoBuffer, filename: LOGO_FILENAME }],
        html,
        subject,
        text,
        to,
      });
      logger.info({ to: maskEmail(to) }, "verification email sent");
    } catch (error) {
      logger.error({ error, to: maskEmail(to) }, "failed to send verification email");
    }
  }

  async sendWelcomeEmail({ to, userName }: { to: string; userName: string }): Promise<void> {
    const safeUserName = userName.trim().length === 0 ? DEFAULT_USER_NAME : userName.trim();
    const dashboardUrl = `${env.webBaseUrl}/dashboard`;
    const addBookUrl = `${env.webBaseUrl}/books/new`;
    const settingsUrl = `${env.webBaseUrl}/settings`;

    const { html, subject, text } = renderWelcomeEmail({
      addBookUrl,
      dashboardUrl,
      settingsUrl,
      userName: safeUserName,
    });

    try {
      await this.mail.send({
        attachments: [{ cid: LOGO_CID, content: this.logoBuffer, filename: LOGO_FILENAME }],
        html,
        subject,
        text,
        to,
      });
      logger.info({ to: maskEmail(to) }, "welcome email sent");
    } catch (error) {
      logger.error({ error, to: maskEmail(to) }, "failed to send welcome email");
    }
  }
}
