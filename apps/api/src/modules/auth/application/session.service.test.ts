import type { Nullable } from "@app/shared";

import { subMilliseconds } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { SessionModel, UserModel } from "../../../generated/prisma/models.js";
import type { SessionsRepository } from "../infrastructure/sessions.repository.js";
import type { UsersRepository } from "../infrastructure/users.repository.js";
import type { TokenService } from "./token.service.js";

import { env } from "../../../config/env.js";
import { UnauthorizedError } from "../../../core/exceptions/errors.js";
import { SESSION_ROTATION, SessionService } from "./session.service.js";

type Mocks = {
  sessionsRepository: SessionsRepository;
  tokenService: TokenService;
  transactionRunner: TransactionRunner;
  usersRepository: UsersRepository;
};

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const FUTURE = new Date("2099-01-01T00:00:00.000Z");
const PAST = new Date("2000-01-01T00:00:00.000Z");

function buildService(overrides: {
  findById?: Nullable<UserModel>;
  findByRefreshHash?: Nullable<SessionModel>;
  rotate?: number;
}): { mocks: Mocks; service: SessionService } {
  const sessionsRepository = {
    create: vi.fn().mockResolvedValue(undefined),
    deleteAllByUserId: vi.fn().mockResolvedValue(undefined),
    deleteById: vi.fn().mockResolvedValue(undefined),
    deleteByRefreshHash: vi.fn().mockResolvedValue(undefined),
    findByRefreshHash: vi.fn().mockResolvedValue(overrides.findByRefreshHash ?? null),
    rotate: vi.fn().mockResolvedValue(overrides.rotate ?? 1),
  } as unknown as SessionsRepository;

  const usersRepository = {
    findById: vi.fn().mockResolvedValue(overrides.findById ?? userModel()),
  } as unknown as UsersRepository;

  const tokenService = {
    generateRefreshToken: vi.fn().mockReturnValue("rotated-refresh-token"),
    hashRefreshToken: vi.fn().mockImplementation((token: string) => `hashed:${token}`),
    refreshExpiry: vi.fn().mockReturnValue(FUTURE),
    signAccessToken: vi.fn().mockResolvedValue("signed-access-token"),
  } as unknown as TokenService;

  const transactionRunner = {
    run: vi.fn().mockImplementation((callback: (tx: unknown) => unknown) => callback({ tx: true })),
  } as unknown as TransactionRunner;

  const service = new SessionService(
    sessionsRepository,
    usersRepository,
    tokenService,
    transactionRunner,
  );

  return {
    mocks: { sessionsRepository, tokenService, transactionRunner, usersRepository },
    service,
  };
}

function sessionModel(overrides: Partial<SessionModel> = {}): SessionModel {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: FUTURE,
    id: SESSION_ID,
    refreshHash: "hashed:presented-refresh-token",
    rotatedAt: null,
    userId: USER_ID,
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
    id: USER_ID,
    lastName: null,
    name: "Reader",
    nickname: null,
    passwordChangedAt: null,
    passwordHash: "stored-hash",
    role: "user",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("SessionService.issue", () => {
  it("uses the long TTL and reports it back when rememberMe is true", async () => {
    const { mocks, service } = buildService({});

    const issued = await service.issue(userModel(), { rememberMe: true });

    expect(issued.ttlDays).toBe(env.refreshTokenTtlDays);
    expect(mocks.tokenService.refreshExpiry).toHaveBeenCalledWith(env.refreshTokenTtlDays);
  });

  it("uses the short TTL and reports it back when rememberMe is false", async () => {
    const { mocks, service } = buildService({});

    const issued = await service.issue(userModel(), { rememberMe: false });

    expect(issued.ttlDays).toBe(env.refreshTokenTtlDaysShort);
    expect(mocks.tokenService.refreshExpiry).toHaveBeenCalledWith(env.refreshTokenTtlDaysShort);
  });

  it("defaults to the long TTL when no rememberMe option is supplied", async () => {
    const { mocks, service } = buildService({});

    const issued = await service.issue(userModel());

    expect(issued.ttlDays).toBe(env.refreshTokenTtlDays);
    expect(mocks.tokenService.refreshExpiry).toHaveBeenCalledWith(env.refreshTokenTtlDays);
  });

  it("persists a session for the user with the chosen expiry", async () => {
    const { mocks, service } = buildService({});

    await service.issue(userModel(), { rememberMe: false });

    expect(mocks.sessionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: FUTURE, userId: USER_ID }),
      undefined,
    );
  });

  it("returns a freshly signed access token and the generated refresh token", async () => {
    const { service } = buildService({});

    const issued = await service.issue(userModel(), { rememberMe: true });

    expect(issued.accessToken).toBe("signed-access-token");
    expect(issued.refreshToken).toBe("rotated-refresh-token");
  });
});

describe("SessionService.refresh", () => {
  it("throws an UnauthorizedError for an unknown token without rotating or creating", async () => {
    const { mocks, service } = buildService({ findByRefreshHash: null });

    await expect(service.refresh("presented-refresh-token")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(mocks.sessionsRepository.rotate).not.toHaveBeenCalled();
    expect(mocks.sessionsRepository.create).not.toHaveBeenCalled();
  });

  it("revokes every session and throws when the presented token was already rotated", async () => {
    const { mocks, service } = buildService({
      findByRefreshHash: sessionModel({ rotatedAt: new Date("2026-01-03T00:00:00.000Z") }),
    });

    await expect(service.refresh("presented-refresh-token")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(mocks.sessionsRepository.deleteAllByUserId).toHaveBeenCalledWith(USER_ID);
    expect(mocks.sessionsRepository.create).not.toHaveBeenCalled();
  });

  it("spares the other devices when a rotation is replayed inside the grace window", async () => {
    const { mocks, service } = buildService({
      findByRefreshHash: sessionModel({
        rotatedAt: subMilliseconds(new Date(), SESSION_ROTATION.reuseGraceMs / 2),
      }),
    });

    await expect(service.refresh("presented-refresh-token")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(mocks.sessionsRepository.deleteAllByUserId).not.toHaveBeenCalled();
    expect(mocks.sessionsRepository.create).not.toHaveBeenCalled();
  });

  it("revokes every session once a replayed rotation is older than the grace window", async () => {
    const { mocks, service } = buildService({
      findByRefreshHash: sessionModel({
        rotatedAt: subMilliseconds(new Date(), SESSION_ROTATION.reuseGraceMs + 1000),
      }),
    });

    await expect(service.refresh("presented-refresh-token")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(mocks.sessionsRepository.deleteAllByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it("deletes the expired session and throws when the session has expired", async () => {
    const { mocks, service } = buildService({
      findByRefreshHash: sessionModel({ expiresAt: PAST }),
    });

    await expect(service.refresh("presented-refresh-token")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(mocks.sessionsRepository.deleteById).toHaveBeenCalledWith(SESSION_ID);
    expect(mocks.sessionsRepository.create).not.toHaveBeenCalled();
  });

  it("rotates the old session, creates a new one and signs a fresh access token on success", async () => {
    const { mocks, service } = buildService({
      findByRefreshHash: sessionModel(),
      rotate: 1,
    });

    const { refreshToken, result } = await service.refresh("presented-refresh-token");

    expect(mocks.sessionsRepository.rotate).toHaveBeenCalledTimes(1);
    expect(mocks.sessionsRepository.create).toHaveBeenCalledTimes(1);
    expect(refreshToken).toBe("rotated-refresh-token");
    expect(refreshToken).not.toBe("presented-refresh-token");
    expect(result.accessToken).toBe("signed-access-token");
    expect(result.user.id).toBe(USER_ID);
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("carries the original session expiry forward instead of minting a fresh one", async () => {
    const originalExpiry = new Date("2030-06-01T00:00:00.000Z");
    const { mocks, service } = buildService({
      findByRefreshHash: sessionModel({ expiresAt: originalExpiry }),
      rotate: 1,
    });

    const { expiresAt } = await service.refresh("presented-refresh-token");

    expect(expiresAt).toEqual(originalExpiry);
    expect(mocks.tokenService.refreshExpiry).not.toHaveBeenCalled();
    expect(mocks.sessionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: originalExpiry, userId: USER_ID }),
      { tx: true },
    );
  });

  it("rejects with an UnauthorizedError without creating a session when it loses the rotation race", async () => {
    const { mocks, service } = buildService({
      findByRefreshHash: sessionModel(),
      rotate: 0,
    });

    await expect(service.refresh("presented-refresh-token")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(mocks.sessionsRepository.create).not.toHaveBeenCalled();
  });
});

describe("SessionService.revoke", () => {
  it("deletes the session by the hashed presented token", async () => {
    const { mocks, service } = buildService({});

    await service.revoke("presented-refresh-token");

    expect(mocks.sessionsRepository.deleteByRefreshHash).toHaveBeenCalledWith(
      "hashed:presented-refresh-token",
    );
  });

  it("resolves without throwing when no session matches the token", async () => {
    const { service } = buildService({});

    await expect(service.revoke("unknown-token")).resolves.toBeUndefined();
  });
});
