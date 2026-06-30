import type { ResetPasswordResultView } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { differenceInSeconds } from "date-fns";

import type { UserModel } from "../../../generated/prisma/models.js";

import { env } from "../../../config/env.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { BadRequestError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { MailService } from "../../mail/application/mail.service.js";
import { PasswordResetTokensRepository } from "../infrastructure/password-reset-tokens.repository.js";
import { SessionsRepository } from "../infrastructure/sessions.repository.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

const INVALID_LINK_MESSAGE = "Invalid or expired reset link";

const logger = createLogger("password-reset");

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly tokensRepository: PasswordResetTokensRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async requestReset(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);
    if (user === null) {
      logger.info({ reason: "no_user" }, "password reset requested, nothing sent");
      return;
    }

    if (user.emailVerifiedAt === null) {
      void this.emailVerificationService.resend(user.email).catch((error: unknown) => {
        logger.error(
          { error, reason: "resend_verification_failed", userId: user.id },
          "failed to resend verification email during password reset",
        );
      });
      logger.info(
        { reason: "unverified_resent_verification", userId: user.id },
        "password reset requested for unverified user, verification resent",
      );
      return;
    }

    const latestToken = await this.tokensRepository.findLatestByUserId(user.id);
    if (latestToken !== null) {
      const elapsedSeconds = differenceInSeconds(new Date(), latestToken.createdAt);
      if (elapsedSeconds < env.resendCooldownSeconds) {
        logger.info(
          { reason: "cooldown_active", userId: user.id },
          "password reset requested within cooldown, nothing sent",
        );
        return;
      }
    }

    const rawToken = await this.issueToken(user);

    void this.mailService.sendPasswordResetEmail({
      resetPasswordUrl: `${env.webBaseUrl}/reset-password?token=${rawToken}`,
      to: user.email,
      userName: user.name,
    });

    logger.info({ reason: "reset_email_issued", userId: user.id }, "password reset email issued");
  }

  async reset(token: string, newPassword: string): Promise<ResetPasswordResultView> {
    const tokenHash = this.tokenService.hashPasswordResetToken(token);
    const passwordHash = await this.passwordService.hash(newPassword);

    const user = await this.prisma.$transaction(async (tx) => {
      const consumed = await this.tokensRepository.consume(tokenHash, new Date(), tx);
      if (consumed === null) {
        throw new BadRequestError(INVALID_LINK_MESSAGE);
      }

      const updatedUser = await this.usersRepository.updatePassword(
        consumed.userId,
        passwordHash,
        tx,
      );
      await this.sessionsRepository.deleteAllByUserId(consumed.userId, tx);

      return updatedUser;
    });

    void this.mailService.sendPasswordChangedEmail({ to: user.email, userName: user.name });

    return { status: "password_reset" };
  }

  private async issueToken(user: UserModel): Promise<string> {
    const rawToken = this.tokenService.generatePasswordResetToken();
    const tokenHash = this.tokenService.hashPasswordResetToken(rawToken);
    const expiresAt = this.tokenService.passwordResetExpiry();

    await this.prisma.$transaction(async (tx) => {
      await this.tokensRepository.deleteByUserId(user.id, tx);
      await this.tokensRepository.create({ expiresAt, tokenHash, userId: user.id }, tx);
    });

    return rawToken;
  }
}
