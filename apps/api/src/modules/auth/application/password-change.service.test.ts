import type { Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { UserModel } from "../../../generated/prisma/models.js";
import type { MailService } from "../../mail/application/mail.service.js";
import type { SessionsRepository } from "../infrastructure/sessions.repository.js";
import type { UsersRepository } from "../infrastructure/users.repository.js";
import type { PasswordService } from "./password.service.js";
import type { SessionService } from "./session.service.js";

import { BadRequestError, UnauthorizedError } from "../../../core/exceptions/errors.js";
import { PasswordChangeService } from "./password-change.service.js";

type Mocks = {
  mailService: MailService;
  passwordService: PasswordService;
  sessionService: SessionService;
  sessionsRepository: SessionsRepository;
  transactionRunner: TransactionRunner;
  usersRepository: UsersRepository;
};

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildService(overrides: { passwordMatches?: boolean; user?: Nullable<UserModel> } = {}): {
  mocks: Mocks;
  service: PasswordChangeService;
} {
  const usersRepository = {
    findById: vi
      .fn()
      .mockResolvedValue(overrides.user === undefined ? userModel() : overrides.user),
    updatePassword: vi
      .fn()
      .mockImplementation((userId: string, passwordHash: string) =>
        Promise.resolve(userModel({ id: userId, passwordHash })),
      ),
  } as unknown as UsersRepository;

  const sessionsRepository = {
    deleteAllByUserId: vi.fn().mockResolvedValue(undefined),
  } as unknown as SessionsRepository;

  const passwordService = {
    compare: vi.fn().mockResolvedValue(overrides.passwordMatches ?? true),
    hash: vi.fn().mockResolvedValue("new-password-hash"),
  } as unknown as PasswordService;

  const sessionService = {
    issue: vi
      .fn()
      .mockResolvedValue({ accessToken: "access", refreshToken: "refresh-token", ttlDays: 30 }),
  } as unknown as SessionService;

  const mailService = {
    sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailService;

  const transactionRunner = {
    run: vi.fn().mockImplementation((callback: (tx: unknown) => unknown) => callback({ tx: true })),
  } as unknown as TransactionRunner;

  const service = new PasswordChangeService(
    usersRepository,
    sessionsRepository,
    passwordService,
    sessionService,
    mailService,
    transactionRunner,
  );

  return {
    mocks: {
      mailService,
      passwordService,
      sessionService,
      sessionsRepository,
      transactionRunner,
      usersRepository,
    },
    service,
  };
}

function changeCommand(): { currentPassword: string; newPassword: string; userId: string } {
  return {
    currentPassword: "Supersecret123!",
    newPassword: "Brandnewpass123!",
    userId: USER_ID,
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
    id: USER_ID,
    lastName: null,
    name: "Reader",
    nickname: null,
    passwordHash: "stored-hash",
    role: "user",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PasswordChangeService.change", () => {
  it("throws a BadRequestError when the current password does not match", async () => {
    const { service } = buildService({ passwordMatches: false });

    await expect(service.change(changeCommand())).rejects.toBeInstanceOf(BadRequestError);
  });

  it("carries a current_password_invalid code on the rejection", async () => {
    const { service } = buildService({ passwordMatches: false });

    await expect(service.change(changeCommand())).rejects.toMatchObject({
      code: "current_password_invalid",
    });
  });

  it("touches neither the password nor the sessions when the current password is wrong", async () => {
    const { mocks, service } = buildService({ passwordMatches: false });

    await service.change(changeCommand()).catch(() => undefined);

    expect(mocks.passwordService.hash).not.toHaveBeenCalled();
    expect(mocks.usersRepository.updatePassword).not.toHaveBeenCalled();
    expect(mocks.sessionsRepository.deleteAllByUserId).not.toHaveBeenCalled();
    expect(mocks.sessionService.issue).not.toHaveBeenCalled();
    expect(mocks.mailService.sendPasswordChangedEmail).not.toHaveBeenCalled();
  });

  it("throws an UnauthorizedError when the user no longer exists", async () => {
    const { mocks, service } = buildService({ user: null });

    await expect(service.change(changeCommand())).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mocks.usersRepository.updatePassword).not.toHaveBeenCalled();
  });

  it("compares the presented current password against the stored hash", async () => {
    const { mocks, service } = buildService();

    await service.change(changeCommand());

    expect(mocks.passwordService.compare).toHaveBeenCalledWith("Supersecret123!", "stored-hash");
  });

  it("stores the hash of the new password and clears every session inside one transaction", async () => {
    const { mocks, service } = buildService();

    await service.change(changeCommand());

    expect(mocks.transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(mocks.passwordService.hash).toHaveBeenCalledWith("Brandnewpass123!");
    expect(mocks.usersRepository.updatePassword).toHaveBeenCalledWith(
      USER_ID,
      "new-password-hash",
      expect.anything(),
    );
    expect(mocks.sessionsRepository.deleteAllByUserId).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
  });

  it("issues a fresh session for the device that changed the password", async () => {
    const { mocks, service } = buildService();

    const changed = await service.change(changeCommand());

    expect(mocks.sessionService.issue).toHaveBeenCalledTimes(1);
    expect(mocks.sessionService.issue).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_ID, passwordHash: "new-password-hash" }),
    );
    expect(changed.refreshToken).toBe("refresh-token");
    expect(changed.ttlDays).toBe(30);
  });

  it("issues the replacement session only after the old ones were deleted", async () => {
    const { mocks, service } = buildService();

    await service.change(changeCommand());

    const [deleteOrder] = vi.mocked(mocks.sessionsRepository.deleteAllByUserId).mock
      .invocationCallOrder;
    const [issueOrder] = vi.mocked(mocks.sessionService.issue).mock.invocationCallOrder;
    expect(deleteOrder ?? Infinity).toBeLessThan(issueOrder ?? 0);
  });

  it("fires the password changed email once and returns a password_changed status", async () => {
    const { mocks, service } = buildService();

    const changed = await service.change(changeCommand());

    expect(mocks.mailService.sendPasswordChangedEmail).toHaveBeenCalledTimes(1);
    expect(mocks.mailService.sendPasswordChangedEmail).toHaveBeenCalledWith({
      to: "reader@example.com",
      userName: "Reader",
    });
    expect(changed.result).toEqual({ status: "password_changed" });
  });
});
