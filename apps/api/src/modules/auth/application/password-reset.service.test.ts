import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { PasswordResetTokenModel, UserModel } from "../../../generated/prisma/models.js";
import type { MailService } from "../../mail/application/mail.service.js";
import type { PasswordResetTokensRepository } from "../infrastructure/password-reset-tokens.repository.js";
import type { SessionsRepository } from "../infrastructure/sessions.repository.js";
import type { UsersRepository } from "../infrastructure/users.repository.js";
import type { EmailVerificationService } from "./email-verification.service.js";
import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { PasswordResetService } from "./password-reset.service.js";

type Mocks = {
  emailVerificationService: EmailVerificationService;
  mailService: MailService;
  passwordService: PasswordService;
  sessionsRepository: SessionsRepository;
  tokenService: TokenService;
  tokensRepository: PasswordResetTokensRepository;
  transactionRunner: TransactionRunner;
  usersRepository: UsersRepository;
};

function buildService(overrides: {
  consume?: null | { userId: string };
  findByEmail?: null | UserModel;
  findLatestByUserId?: null | PasswordResetTokenModel;
}): { mocks: Mocks; service: PasswordResetService } {
  const usersRepository = {
    findByEmail: vi.fn().mockResolvedValue(overrides.findByEmail ?? null),
    updatePassword: vi
      .fn()
      .mockImplementation((userId: string, passwordHash: string) =>
        Promise.resolve(userModel({ id: userId, passwordHash })),
      ),
  } as unknown as UsersRepository;

  const tokensRepository = {
    consume: vi.fn().mockResolvedValue(overrides.consume ?? null),
    create: vi.fn().mockResolvedValue(undefined),
    deleteByUserId: vi.fn().mockResolvedValue(undefined),
    findLatestByUserId: vi.fn().mockResolvedValue(overrides.findLatestByUserId ?? null),
  } as unknown as PasswordResetTokensRepository;

  const sessionsRepository = {
    deleteAllByUserId: vi.fn().mockResolvedValue(undefined),
  } as unknown as SessionsRepository;

  const tokenService = {
    generatePasswordResetToken: vi.fn().mockReturnValue("raw-reset-token"),
    hashPasswordResetToken: vi.fn().mockReturnValue("hashed-reset-token"),
    passwordResetExpiry: vi.fn().mockReturnValue(new Date("2099-01-01T00:00:00.000Z")),
  } as unknown as TokenService;

  const passwordService = {
    hash: vi.fn().mockResolvedValue("new-password-hash"),
  } as unknown as PasswordService;

  const emailVerificationService = {
    resend: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailVerificationService;

  const mailService = {
    sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailService;

  const transactionRunner = {
    run: vi.fn().mockImplementation((callback: (tx: unknown) => unknown) => callback({ tx: true })),
  } as unknown as TransactionRunner;

  const service = new PasswordResetService(
    usersRepository,
    tokensRepository,
    sessionsRepository,
    tokenService,
    passwordService,
    emailVerificationService,
    mailService,
    transactionRunner,
  );

  return {
    mocks: {
      emailVerificationService,
      mailService,
      passwordService,
      sessionsRepository,
      tokenService,
      tokensRepository,
      transactionRunner,
      usersRepository,
    },
    service,
  };
}

function tokenRow(overrides: Partial<PasswordResetTokenModel> = {}): PasswordResetTokenModel {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    id: "33333333-3333-4333-8333-333333333333",
    tokenHash: "hashed-reset-token",
    userId: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

function userModel(overrides: Partial<UserModel> = {}): UserModel {
  return {
    avatarUrl: null,
    bio: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dateOfBirth: null,
    email: "reader@example.com",
    emailVerifiedAt: new Date("2026-01-02T00:00:00.000Z"),
    favoriteBookQuote: null,
    favoriteGenres: [],
    id: "11111111-1111-4111-8111-111111111111",
    lastName: null,
    name: "Reader",
    nickname: null,
    passwordHash: "stored-hash",
    role: "user",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PasswordResetService.requestReset", () => {
  it("issues a token by deleting old ones then creating one for a verified user with no prior token", async () => {
    const { mocks, service } = buildService({ findByEmail: userModel() });

    await service.requestReset("reader@example.com");

    expect(mocks.tokensRepository.deleteByUserId).toHaveBeenCalledTimes(1);
    expect(mocks.tokensRepository.create).toHaveBeenCalledTimes(1);
    const [deleteOrder] = vi.mocked(mocks.tokensRepository.deleteByUserId).mock.invocationCallOrder;
    const [createOrder] = vi.mocked(mocks.tokensRepository.create).mock.invocationCallOrder;
    expect(deleteOrder ?? Infinity).toBeLessThan(createOrder ?? 0);
  });

  it("sends a reset email carrying the raw token in the reset url for a verified user", async () => {
    const { mocks, service } = buildService({ findByEmail: userModel() });

    await service.requestReset("reader@example.com");

    expect(mocks.mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(mocks.mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        resetPasswordUrl: expect.stringContaining("token=raw-reset-token"),
        to: "reader@example.com",
      }),
    );
  });

  it("does nothing for an unknown email", async () => {
    const { mocks, service } = buildService({ findByEmail: null });

    await service.requestReset("ghost@example.com");

    expect(mocks.tokensRepository.deleteByUserId).not.toHaveBeenCalled();
    expect(mocks.tokensRepository.create).not.toHaveBeenCalled();
    expect(mocks.mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("resends a verification email and sends no reset email for a known unverified user", async () => {
    const { mocks, service } = buildService({
      findByEmail: userModel({ emailVerifiedAt: null }),
    });

    await service.requestReset("reader@example.com");

    expect(mocks.emailVerificationService.resend).toHaveBeenCalledTimes(1);
    expect(mocks.emailVerificationService.resend).toHaveBeenCalledWith("reader@example.com");
    expect(mocks.tokensRepository.create).not.toHaveBeenCalled();
    expect(mocks.mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("does not resend verification for a verified user", async () => {
    const { mocks, service } = buildService({ findByEmail: userModel() });

    await service.requestReset("reader@example.com");

    expect(mocks.emailVerificationService.resend).not.toHaveBeenCalled();
  });

  it("skips issuing and sends nothing when the latest token is younger than the cooldown", async () => {
    const { mocks, service } = buildService({
      findByEmail: userModel(),
      findLatestByUserId: tokenRow({ createdAt: new Date() }),
    });

    await service.requestReset("reader@example.com");

    expect(mocks.tokensRepository.deleteByUserId).not.toHaveBeenCalled();
    expect(mocks.tokensRepository.create).not.toHaveBeenCalled();
    expect(mocks.mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe("PasswordResetService.reset", () => {
  it("updates the password with the bcrypt hash and invalidates all sessions on a valid token", async () => {
    const { mocks, service } = buildService({
      consume: { userId: "11111111-1111-4111-8111-111111111111" },
    });

    const result = await service.reset("raw-reset-token", "Supersecret123!");

    expect(result).toEqual({ status: "password_reset" });
    expect(mocks.usersRepository.updatePassword).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "new-password-hash",
      expect.anything(),
    );
    expect(mocks.sessionsRepository.deleteAllByUserId).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.anything(),
    );
  });

  it("fires the password changed email once after a successful reset", async () => {
    const { mocks, service } = buildService({
      consume: { userId: "11111111-1111-4111-8111-111111111111" },
    });

    await service.reset("raw-reset-token", "Supersecret123!");

    expect(mocks.mailService.sendPasswordChangedEmail).toHaveBeenCalledTimes(1);
  });

  it("throws a BadRequestError when the token cannot be consumed", async () => {
    const { service } = buildService({ consume: null });

    await expect(service.reset("missing", "Supersecret123!")).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("does not update the password, invalidate sessions or send mail when the token is invalid", async () => {
    const { mocks, service } = buildService({ consume: null });

    await service.reset("expired-or-used", "Supersecret123!").catch(() => undefined);

    expect(mocks.usersRepository.updatePassword).not.toHaveBeenCalled();
    expect(mocks.sessionsRepository.deleteAllByUserId).not.toHaveBeenCalled();
    expect(mocks.mailService.sendPasswordChangedEmail).not.toHaveBeenCalled();
  });
});
