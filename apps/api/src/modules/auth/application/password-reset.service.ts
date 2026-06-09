import type { ResetPasswordResultView } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { differenceInSeconds } from "date-fns";

import type { UserModel } from "../../../generated/prisma/models.js";

import { env } from "../../../config/env.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { BadRequestError } from "../../../core/exceptions/errors.js";
import { MailService } from "../../mail/application/mail.service.js";
import { PasswordResetTokensRepository } from "../infrastructure/password-reset-tokens.repository.js";
import { SessionsRepository } from "../infrastructure/sessions.repository.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

const INVALID_LINK_MESSAGE = "Invalid or expired reset link";

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly tokensRepository: PasswordResetTokensRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async requestReset(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);
    if (user === null || user.emailVerifiedAt === null) return;

    const latestToken = await this.tokensRepository.findLatestByUserId(user.id);
    if (latestToken !== null) {
      const elapsedSeconds = differenceInSeconds(new Date(), latestToken.createdAt);
      if (elapsedSeconds < env.resendCooldownSeconds) return;
    }

    const rawToken = await this.issueToken(user);

    void this.mailService.sendPasswordResetEmail({
      resetPasswordUrl: `${env.webBaseUrl}/reset-password?token=${rawToken}`,
      to: user.email,
      userName: user.name,
    });
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
    await this.tokensRepository.deleteByUserId(user.id);

    const rawToken = this.tokenService.generatePasswordResetToken();
    const tokenHash = this.tokenService.hashPasswordResetToken(rawToken);
    const expiresAt = this.tokenService.passwordResetExpiry();

    await this.tokensRepository.create({ expiresAt, tokenHash, userId: user.id });

    return rawToken;
  }
}
