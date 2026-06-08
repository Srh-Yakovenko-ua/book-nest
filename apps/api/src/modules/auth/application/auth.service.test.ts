import type { RegistrationInput } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../core/database/prisma.service.js";
import type { UserModel } from "../../../generated/prisma/models.js";
import type { UsersRepository } from "../infrastructure/users.repository.js";
import type { EmailVerificationService } from "./email-verification.service.js";
import type { PasswordService } from "./password.service.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { AuthService } from "./auth.service.js";

const baseInput: RegistrationInput = {
  email: "reader@example.com",
  name: "Reader",
  password: "supersecret",
};

type Mocks = {
  emailVerificationService: EmailVerificationService;
  passwordService: PasswordService;
  prisma: PrismaService;
  usersRepository: UsersRepository;
};

function buildService(overrides: {
  findByEmail?: null | UserModel;
  findByNickname?: null | UserModel;
  sendVerification?: EmailVerificationService["sendVerification"];
}): { mocks: Mocks; service: AuthService } {
  const usersRepository = {
    create: vi
      .fn()
      .mockImplementation((data: { email: string; name: string }) =>
        Promise.resolve(createdUser({ email: data.email, name: data.name })),
      ),
    deleteById: vi.fn().mockResolvedValue(undefined),
    findByEmail: vi.fn().mockResolvedValue(overrides.findByEmail ?? null),
    findByNickname: vi.fn().mockResolvedValue(overrides.findByNickname ?? null),
  } as unknown as UsersRepository;

  const passwordService = {
    hash: vi.fn().mockResolvedValue("hashed-password"),
  } as unknown as PasswordService;

  const prisma = {
    $transaction: vi
      .fn()
      .mockImplementation((callback: (tx: unknown) => unknown) => callback({ tx: true })),
  } as unknown as PrismaService;

  const emailVerificationService = {
    issueToken: vi.fn().mockResolvedValue("raw-verification-token"),
    sendVerification: overrides.sendVerification ?? vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailVerificationService;

  const service = new AuthService(
    usersRepository,
    passwordService,
    emailVerificationService,
    prisma,
  );

  return {
    mocks: {
      emailVerificationService,
      passwordService,
      prisma,
      usersRepository,
    },
    service,
  };
}

function createdUser(overrides: Partial<UserModel> = {}): UserModel {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    dateOfBirth: null,
    email: "reader@example.com",
    emailVerifiedAt: null,
    id: "11111111-1111-4111-8111-111111111111",
    name: "Reader",
    nickname: null,
    passwordHash: "stored-hash",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function verifiedUser(overrides: Partial<UserModel> = {}): UserModel {
  return createdUser({ emailVerifiedAt: new Date("2026-01-05T00:00:00.000Z"), ...overrides });
}

describe("AuthService.register", () => {
  it("returns a verification_sent status with the registered email and no session", async () => {
    const { service } = buildService({});

    const output = await service.register(baseInput);

    expect(output).toEqual({ email: "reader@example.com", status: "verification_sent" });
    expect(output).not.toHaveProperty("accessToken");
  });

  it("hashes the plaintext password before persisting the user", async () => {
    const { mocks, service } = buildService({});

    await service.register(baseInput);

    expect(mocks.passwordService.hash).toHaveBeenCalledWith("supersecret");
    expect(mocks.usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "hashed-password" }),
      expect.anything(),
    );
  });

  it("creates the user and issues a verification token inside a single transaction", async () => {
    const { mocks, service } = buildService({});

    await service.register(baseInput);

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.emailVerificationService.issueToken).toHaveBeenCalledWith(
      expect.objectContaining({ email: "reader@example.com" }),
      expect.anything(),
    );
  });

  it("does not open a session during registration", async () => {
    const { mocks, service } = buildService({});

    await service.register(baseInput);

    expect(mocks.emailVerificationService.sendVerification).toHaveBeenCalledTimes(1);
  });

  it("throws a BadRequestError with an email field error when a verified email is taken", async () => {
    const { service } = buildService({ findByEmail: verifiedUser() });

    await expect(service.register(baseInput)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("does not create a user when a verified email is already registered", async () => {
    const { mocks, service } = buildService({ findByEmail: verifiedUser() });

    await service.register(baseInput).catch(() => undefined);

    expect(mocks.usersRepository.create).not.toHaveBeenCalled();
  });

  it("surfaces the email field on the error when a verified email is taken", async () => {
    const { service } = buildService({ findByEmail: verifiedUser() });

    const error = await service.register(baseInput).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestError);
    expect((error as BadRequestError).fields).toEqual([
      expect.objectContaining({ field: "email" }),
    ]);
  });

  it("replaces a stale unverified account and returns verification_sent", async () => {
    const { mocks, service } = buildService({
      findByEmail: createdUser({ id: "99999999-9999-4999-8999-999999999999" }),
    });

    const output = await service.register(baseInput);

    expect(output).toEqual({ email: "reader@example.com", status: "verification_sent" });
    expect(mocks.usersRepository.deleteById).toHaveBeenCalledWith(
      "99999999-9999-4999-8999-999999999999",
      expect.anything(),
    );
    expect(mocks.usersRepository.create).toHaveBeenCalledTimes(1);
  });

  it("does not delete any account for a brand-new email", async () => {
    const { mocks, service } = buildService({});

    await service.register(baseInput);

    expect(mocks.usersRepository.deleteById).not.toHaveBeenCalled();
  });

  it("throws a BadRequestError with a nickname field error when the nickname is taken", async () => {
    const { service } = buildService({ findByNickname: createdUser() });

    const error = await service
      .register({ ...baseInput, nickname: "reader" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestError);
    expect((error as BadRequestError).fields).toEqual([
      expect.objectContaining({ field: "nickname" }),
    ]);
  });

  it("skips the nickname uniqueness check when no nickname is provided", async () => {
    const { mocks, service } = buildService({});

    await service.register(baseInput);

    expect(mocks.usersRepository.findByNickname).not.toHaveBeenCalled();
  });

  it("succeeds when the nickname is omitted", async () => {
    const { service } = buildService({});

    const output = await service.register(baseInput);

    expect(output.status).toBe("verification_sent");
  });

  it("fires the verification email once for the freshly created user", async () => {
    const { mocks, service } = buildService({});

    await service.register(baseInput);

    expect(mocks.emailVerificationService.sendVerification).toHaveBeenCalledWith(
      expect.objectContaining({ email: "reader@example.com" }),
      "raw-verification-token",
    );
  });

  it("still resolves when sending the verification email rejects", async () => {
    const { service } = buildService({
      sendVerification: vi.fn().mockRejectedValue(new Error("smtp down")),
    });

    const output = await service.register(baseInput);

    expect(output.status).toBe("verification_sent");
  });
});
