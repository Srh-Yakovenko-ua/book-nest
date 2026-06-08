import type { RegistrationInput, RegistrationResultView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { BadRequestError } from "../../../core/exceptions/errors.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { PasswordService } from "./password.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly prisma: PrismaService,
  ) {}

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
          dateOfBirth: input.dateOfBirth === undefined ? undefined : new Date(input.dateOfBirth),
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
