import type {
  AuthResultView,
  LoginInput,
  NicknameAvailabilityView,
  RegistrationInput,
  RegistrationResultView,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { UserModel } from "../../../generated/prisma/models.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../../../core/exceptions/errors.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { isUniqueConstraintErrorOn } from "../../../core/prisma-errors.js";
import { toUserView } from "../domain/user.mapper.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { LoginAttemptLimiter } from "./login-attempt-limiter.js";
import { PasswordService } from "./password.service.js";
import { SessionService } from "./session.service.js";

const EMAIL_TAKEN_MESSAGE = "Email already registered";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
const NICKNAME_TAKEN_MESSAGE = "Nickname already taken";
const USER_EMAIL_UNIQUE_CONSTRAINT = "users_email_key";
const USER_NICKNAME_UNIQUE_CONSTRAINT = "users_nickname_key";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly sessionService: SessionService,
    private readonly transactionRunner: TransactionRunner,
    private readonly loginAttemptLimiter: LoginAttemptLimiter,
  ) {}

  async isNicknameAvailable(nickname: string): Promise<NicknameAvailabilityView> {
    const existing = await this.usersRepository.findByNickname(nickname);

    return { available: existing === null };
  }

  async login({
    clientIp,
    input,
  }: {
    clientIp: string;
    input: LoginInput;
  }): Promise<{ refreshToken: string; result: AuthResultView; ttlDays: number }> {
    const attemptIdentity = { clientIp, email: input.email };
    await this.loginAttemptLimiter.assertAttemptAllowed(attemptIdentity);

    const user = await this.usersRepository.findByEmail(input.email);
    if (user === null) {
      await this.passwordService.fakeCompare(input.password);
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await this.passwordService.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.loginAttemptLimiter.clear(attemptIdentity);

    if (user.emailVerifiedAt === null) {
      throw new ForbiddenError("Email not verified", { code: "email_not_verified" });
    }

    const session = await this.sessionService.issue(user, { rememberMe: input.rememberMe });

    return {
      refreshToken: session.refreshToken,
      result: { accessToken: session.accessToken, user: toUserView(user) },
      ttlDays: session.ttlDays,
    };
  }

  async register(input: RegistrationInput): Promise<RegistrationResultView> {
    const existingByEmail = await this.usersRepository.findByEmail(input.email);
    if (existingByEmail !== null && existingByEmail.emailVerifiedAt !== null) {
      throw emailTakenError();
    }

    const staleUnverifiedUserId = existingByEmail === null ? null : existingByEmail.id;
    const passwordHash = await this.passwordService.hash(input.password);

    let result: { rawToken: string; user: UserModel };
    try {
      result = await this.transactionRunner.run(async (tx) => {
        if (staleUnverifiedUserId !== null) {
          await this.usersRepository.deleteById(staleUnverifiedUserId, tx);
        }

        if (input.nickname !== undefined) {
          const existingByNickname = await this.usersRepository.findByNickname(input.nickname, tx);
          if (existingByNickname !== null) {
            throw nicknameTakenError();
          }
        }

        const created = await this.usersRepository.create(
          {
            dateOfBirth:
              input.dateOfBirth === undefined ? undefined : parseIsoDate(input.dateOfBirth),
            email: input.email,
            name: input.name,
            nickname: input.nickname,
            passwordHash,
          },
          tx,
        );
        const token = await this.emailVerificationService.issueToken(created, tx);
        return { rawToken: token, user: created };
      });
    } catch (error) {
      throw mapRegistrationUniqueViolation(error);
    }

    void this.emailVerificationService.sendVerification(result.user, result.rawToken);

    return { email: result.user.email, status: "verification_sent" };
  }
}

function emailTakenError(): BadRequestError {
  return new BadRequestError(EMAIL_TAKEN_MESSAGE, {
    fields: [{ field: "email", message: EMAIL_TAKEN_MESSAGE }],
  });
}

function mapRegistrationUniqueViolation(error: unknown): unknown {
  if (isUniqueConstraintErrorOn(error, USER_EMAIL_UNIQUE_CONSTRAINT)) {
    return emailTakenError();
  }
  if (isUniqueConstraintErrorOn(error, USER_NICKNAME_UNIQUE_CONSTRAINT)) {
    return nicknameTakenError();
  }
  return error;
}

function nicknameTakenError(): BadRequestError {
  return new BadRequestError(NICKNAME_TAKEN_MESSAGE, {
    fields: [{ field: "nickname", message: NICKNAME_TAKEN_MESSAGE }],
  });
}
