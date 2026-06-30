import type {
  AuthResultView,
  LoginInput,
  NicknameAvailabilityView,
  RegistrationInput,
  RegistrationResultView,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../../../core/exceptions/errors.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { toUserView } from "../domain/user.mapper.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { PasswordService } from "./password.service.js";
import { SessionService } from "./session.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly sessionService: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async isNicknameAvailable(nickname: string): Promise<NicknameAvailabilityView> {
    const existing = await this.usersRepository.findByNickname(nickname);

    return { available: existing === null };
  }

  async login(
    input: LoginInput,
  ): Promise<{ refreshToken: string; result: AuthResultView; ttlDays: number }> {
    const user = await this.usersRepository.findByEmail(input.email);
    if (user === null) {
      await this.passwordService.fakeCompare(input.password);
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await this.passwordService.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

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
      throw new BadRequestError("Email already registered", {
        fields: [{ field: "email", message: "Email already registered" }],
      });
    }

    const staleUnverifiedUserId = existingByEmail === null ? null : existingByEmail.id;
    const passwordHash = await this.passwordService.hash(input.password);

    const { rawToken, user } = await this.prisma.$transaction(async (tx) => {
      if (staleUnverifiedUserId !== null) {
        await this.usersRepository.deleteById(staleUnverifiedUserId, tx);
      }

      if (input.nickname !== undefined) {
        const existingByNickname = await this.usersRepository.findByNickname(input.nickname, tx);
        if (existingByNickname !== null) {
          throw new BadRequestError("Nickname already taken", {
            fields: [{ field: "nickname", message: "Nickname already taken" }],
          });
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

    void this.emailVerificationService.sendVerification(user, rawToken);

    return { email: user.email, status: "verification_sent" };
  }
}
