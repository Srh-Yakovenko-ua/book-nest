import type { AuthResultView } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { differenceInSeconds } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserModel } from "../../../generated/prisma/models.js";

import { env } from "../../../config/env.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { BadRequestError } from "../../../core/exceptions/errors.js";
import { MailService } from "../../mail/application/mail.service.js";
import { toUserView } from "../domain/user.mapper.js";
import { EmailVerificationTokensRepository } from "../infrastructure/email-verification-tokens.repository.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { SessionService } from "./session.service.js";
import { TokenService } from "./token.service.js";

type VerifyResult = {
  refreshToken: string;
  result: AuthResultView;
};

const INVALID_LINK_MESSAGE = "Invalid or expired verification link";

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly tokensRepository: EmailVerificationTokensRepository,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async issueToken(user: UserModel, client?: Prisma.TransactionClient): Promise<string> {
    await this.tokensRepository.deleteByUserId(user.id, client);

    const rawToken = this.tokenService.generateVerificationToken();
    const tokenHash = this.tokenService.hashVerificationToken(rawToken);
    const expiresAt = this.tokenService.verificationExpiry();

    await this.tokensRepository.create({ expiresAt, tokenHash, userId: user.id }, client);

    return rawToken;
  }

  async resend(email: string): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);
    if (user === null || user.emailVerifiedAt !== null) return;

    const latestToken = await this.tokensRepository.findLatestByUserId(user.id);
    if (latestToken !== null) {
      const elapsedSeconds = differenceInSeconds(new Date(), latestToken.createdAt);
      if (elapsedSeconds < env.resendCooldownSeconds) return;
    }

    const rawToken = await this.issueToken(user);

    void this.sendVerification(user, rawToken);
  }

  sendVerification(user: UserModel, rawToken: string): Promise<void> {
    const verificationUrl = `${env.webBaseUrl}/verify-email?token=${rawToken}`;

    return this.mailService.sendVerificationEmail({
      expiresInMinutes: env.emailVerificationTtlMinutes,
      to: user.email,
      userName: user.name,
      verificationUrl,
    });
  }

  async verify(token: string): Promise<VerifyResult> {
    const tokenHash = this.tokenService.hashVerificationToken(token);

    const { refreshToken, result, verifiedUser } = await this.prisma.$transaction(async (tx) => {
      const consumed = await this.tokensRepository.consume(tokenHash, new Date(), tx);
      if (consumed === null) {
        throw new BadRequestError(INVALID_LINK_MESSAGE);
      }

      const updatedUser = await this.usersRepository.markEmailVerified(
        consumed.userId,
        new Date(),
        tx,
      );
      const session = await this.sessionService.issue(updatedUser, tx);

      return {
        refreshToken: session.refreshToken,
        result: { accessToken: session.accessToken, user: toUserView(updatedUser) },
        verifiedUser: updatedUser,
      };
    });

    void this.mailService.sendWelcomeEmail({ to: verifiedUser.email, userName: verifiedUser.name });

    return { refreshToken, result };
  }
}
