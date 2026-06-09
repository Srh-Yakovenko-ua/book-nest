import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../core/database/prisma.service.js";
import type { EmailVerificationTokenModel, UserModel } from "../../../generated/prisma/models.js";
import type { MailService } from "../../mail/application/mail.service.js";
import type { EmailVerificationTokensRepository } from "../infrastructure/email-verification-tokens.repository.js";
import type { UsersRepository } from "../infrastructure/users.repository.js";
import type { SessionService } from "./session.service.js";
import type { TokenService } from "./token.service.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { EmailVerificationService } from "./email-verification.service.js";

type Mocks = {
  mailService: MailService;
  prisma: PrismaService;
  sessionService: SessionService;
  tokenService: TokenService;
  tokensRepository: EmailVerificationTokensRepository;
  usersRepository: UsersRepository;
};

function buildService(overrides: {
  consume?: null | { userId: string };
  findByEmail?: null | UserModel;
  findLatestByUserId?: EmailVerificationTokenModel | null;
}): { mocks: Mocks; service: EmailVerificationService } {
  const usersRepository = {
    findByEmail: vi.fn().mockResolvedValue(overrides.findByEmail ?? null),
    markEmailVerified: vi
      .fn()
      .mockImplementation((userId: string, verifiedAt: Date) =>
        Promise.resolve(userModel({ emailVerifiedAt: verifiedAt, id: userId })),
      ),
  } as unknown as UsersRepository;

  const tokensRepository = {
    consume: vi.fn().mockResolvedValue(overrides.consume ?? null),
    create: vi.fn().mockResolvedValue(undefined),
    deleteByUserId: vi.fn().mockResolvedValue(undefined),
    findLatestByUserId: vi.fn().mockResolvedValue(overrides.findLatestByUserId ?? null),
  } as unknown as EmailVerificationTokensRepository;

  const tokenService = {
    generateVerificationToken: vi.fn().mockReturnValue("raw-verification-token"),
    hashVerificationToken: vi.fn().mockReturnValue("hashed-verification-token"),
    verificationExpiry: vi.fn().mockReturnValue(new Date("2026-02-01T00:00:00.000Z")),
  } as unknown as TokenService;

  const sessionService = {
    issue: vi
      .fn()
      .mockResolvedValue({ accessToken: "signed-access-token", refreshToken: "raw-refresh-token" }),
  } as unknown as SessionService;

  const mailService = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailService;

  const prisma = {
    $transaction: vi
      .fn()
      .mockImplementation((callback: (tx: unknown) => unknown) => callback({ tx: true })),
  } as unknown as PrismaService;

  const service = new EmailVerificationService(
    usersRepository,
    tokensRepository,
    tokenService,
    sessionService,
    mailService,
    prisma,
  );

  return {
    mocks: {
      mailService,
      prisma,
      sessionService,
      tokenService,
      tokensRepository,
      usersRepository,
    },
    service,
  };
}

function tokenRow(
  overrides: Partial<EmailVerificationTokenModel> = {},
): EmailVerificationTokenModel {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    id: "22222222-2222-4222-8222-222222222222",
    tokenHash: "hashed-verification-token",
    userId: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

function userModel(overrides: Partial<UserModel> = {}): UserModel {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dateOfBirth: null,
    email: "reader@example.com",
    emailVerifiedAt: null,
    id: "11111111-1111-4111-8111-111111111111",
    name: "Reader",
    nickname: null,
    passwordHash: "stored-hash",
    role: "user",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("EmailVerificationService.verify", () => {
  it("returns an access token, refresh token and a verified user view on success", async () => {
    const { service } = buildService({
      consume: { userId: "11111111-1111-4111-8111-111111111111" },
    });

    const { refreshToken, result } = await service.verify("raw-verification-token");

    expect(result.accessToken).toBe("signed-access-token");
    expect(refreshToken).toBe("raw-refresh-token");
    expect(result.user.emailVerified).toBe(true);
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("consumes the token, marks the user verified and issues a session in one transaction", async () => {
    const { mocks, service } = buildService({
      consume: { userId: "11111111-1111-4111-8111-111111111111" },
    });

    await service.verify("raw-verification-token");

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tokensRepository.consume).toHaveBeenCalledWith(
      "hashed-verification-token",
      expect.any(Date),
      expect.anything(),
    );
    expect(mocks.usersRepository.markEmailVerified).toHaveBeenCalledTimes(1);
    expect(mocks.sessionService.issue).toHaveBeenCalledTimes(1);
  });

  it("fires the welcome email once after a successful verification", async () => {
    const { mocks, service } = buildService({
      consume: { userId: "11111111-1111-4111-8111-111111111111" },
    });

    await service.verify("raw-verification-token");

    expect(mocks.mailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it("throws a BadRequestError when the token cannot be consumed", async () => {
    const { mocks, service } = buildService({ consume: null });

    await expect(service.verify("missing")).rejects.toBeInstanceOf(BadRequestError);
    expect(mocks.usersRepository.markEmailVerified).not.toHaveBeenCalled();
    expect(mocks.sessionService.issue).not.toHaveBeenCalled();
  });

  it("does not fire the welcome email when the token cannot be consumed", async () => {
    const { mocks, service } = buildService({ consume: null });

    await service.verify("expired-or-used").catch(() => undefined);

    expect(mocks.mailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});

describe("EmailVerificationService.resend", () => {
  it("does nothing for an unknown email", async () => {
    const { mocks, service } = buildService({ findByEmail: null });

    await service.resend("unknown@example.com");

    expect(mocks.tokensRepository.create).not.toHaveBeenCalled();
    expect(mocks.mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("issues a fresh token and sends an email for a known unverified user", async () => {
    const { mocks, service } = buildService({ findByEmail: userModel({ emailVerifiedAt: null }) });

    await service.resend("reader@example.com");

    expect(mocks.tokensRepository.deleteByUserId).toHaveBeenCalledTimes(1);
    expect(mocks.tokensRepository.create).toHaveBeenCalledTimes(1);
    expect(mocks.mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a known already verified user", async () => {
    const verified = userModel({ emailVerifiedAt: new Date("2026-01-05T00:00:00.000Z") });
    const { mocks, service } = buildService({ findByEmail: verified });

    await service.resend("reader@example.com");

    expect(mocks.tokensRepository.create).not.toHaveBeenCalled();
    expect(mocks.mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("skips regeneration and sends nothing when the latest token is younger than the cooldown", async () => {
    const freshToken = tokenRow({ createdAt: new Date() });
    const { mocks, service } = buildService({
      findByEmail: userModel({ emailVerifiedAt: null }),
      findLatestByUserId: freshToken,
    });

    await service.resend("reader@example.com");

    expect(mocks.tokensRepository.deleteByUserId).not.toHaveBeenCalled();
    expect(mocks.tokensRepository.create).not.toHaveBeenCalled();
    expect(mocks.mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("regenerates and resends when the latest token is older than the cooldown", async () => {
    const staleToken = tokenRow({ createdAt: new Date("2020-01-01T00:00:00.000Z") });
    const { mocks, service } = buildService({
      findByEmail: userModel({ emailVerifiedAt: null }),
      findLatestByUserId: staleToken,
    });

    await service.resend("reader@example.com");

    expect(mocks.tokensRepository.deleteByUserId).toHaveBeenCalledTimes(1);
    expect(mocks.tokensRepository.create).toHaveBeenCalledTimes(1);
    expect(mocks.mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});
