import type { ChangePasswordResultView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, UnauthorizedError } from "../../../core/exceptions/errors.js";
import { MailService } from "../../mail/index.js";
import { PasswordResetTokensRepository } from "../infrastructure/password-reset-tokens.repository.js";
import { SessionsRepository } from "../infrastructure/sessions.repository.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { PasswordService } from "./password.service.js";
import { SessionService } from "./session.service.js";

type ChangedPassword = {
  refreshToken: string;
  result: ChangePasswordResultView;
  ttlDays: number;
};

type ChangePasswordCommand = {
  currentPassword: string;
  newPassword: string;
  userId: string;
};

const CURRENT_PASSWORD_INVALID = {
  code: "current_password_invalid",
  message: "Current password is incorrect",
} as const;

const USER_NOT_FOUND_MESSAGE = "User not found";

@Injectable()
export class PasswordChangeService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly mailService: MailService,
    private readonly transactionRunner: TransactionRunner,
    private readonly passwordResetTokensRepository: PasswordResetTokensRepository,
  ) {}

  async change({
    currentPassword,
    newPassword,
    userId,
  }: ChangePasswordCommand): Promise<ChangedPassword> {
    const user = await this.usersRepository.findById(userId);
    if (user === null) {
      throw new UnauthorizedError(USER_NOT_FOUND_MESSAGE);
    }

    const currentPasswordMatches = await this.passwordService.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!currentPasswordMatches) {
      throw new BadRequestError(CURRENT_PASSWORD_INVALID.message, {
        code: CURRENT_PASSWORD_INVALID.code,
      });
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    const updatedUser = await this.transactionRunner.run(async (tx) => {
      const updated = await this.usersRepository.updatePassword(userId, passwordHash, tx);
      await this.sessionsRepository.deleteAllByUserId(userId, tx);
      await this.passwordResetTokensRepository.deleteByUserId(userId, tx);

      return updated;
    });

    const session = await this.sessionService.issue(updatedUser);

    void this.mailService.sendPasswordChangedEmail({
      to: updatedUser.email,
      userName: updatedUser.name,
    });

    return {
      refreshToken: session.refreshToken,
      result: { status: "password_changed" },
      ttlDays: session.ttlDays,
    };
  }
}
