import type { AuthResultView } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { differenceInMilliseconds, isAfter, milliseconds } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserModel } from "../../../generated/prisma/models.js";

import { env } from "../../../config/env.js";
import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { UnauthorizedError } from "../../../core/exceptions/errors.js";
import { toUserView } from "../domain/user.mapper.js";
import { SessionsRepository } from "../infrastructure/sessions.repository.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { AuthEvents } from "./auth-events.js";
import { TokenService } from "./token.service.js";

type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  ttlDays: number;
};

type IssueSessionOptions = {
  client?: Prisma.TransactionClient;
  rememberMe?: boolean;
};

type RefreshResult = {
  expiresAt: Date;
  refreshToken: string;
  result: AuthResultView;
};

const INVALID_SESSION_MESSAGE = "Invalid session";
const SESSION_REUSE_MESSAGE = "Session reuse detected";
const SESSION_EXPIRED_MESSAGE = "Session expired";

export const SESSION_ROTATION = {
  reuseGraceMs: milliseconds({ seconds: 10 }),
} as const satisfies Record<string, number>;

@Injectable()
export class SessionService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly tokenService: TokenService,
    private readonly transactionRunner: TransactionRunner,
    private readonly authEvents: AuthEvents,
  ) {}

  async issue(user: UserModel, options: IssueSessionOptions = {}): Promise<IssuedSession> {
    const rememberMe = options.rememberMe ?? true;
    const ttlDays = rememberMe ? env.refreshTokenTtlDays : env.refreshTokenTtlDaysShort;

    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshHash = this.tokenService.hashRefreshToken(refreshToken);
    const expiresAt = this.tokenService.refreshExpiry(ttlDays);

    await this.sessionsRepository.create(
      { expiresAt, refreshHash, userId: user.id },
      options.client,
    );

    const accessToken = await this.tokenService.signAccessToken(user.id);

    return { accessToken, refreshToken, ttlDays };
  }

  async refresh(presentedToken: string): Promise<RefreshResult> {
    const now = new Date();
    const refreshHash = this.tokenService.hashRefreshToken(presentedToken);
    const session = await this.sessionsRepository.findByRefreshHash(refreshHash);

    if (session === null) {
      throw new UnauthorizedError(INVALID_SESSION_MESSAGE);
    }

    if (session.rotatedAt !== null) {
      if (differenceInMilliseconds(now, session.rotatedAt) <= SESSION_ROTATION.reuseGraceMs) {
        throw new UnauthorizedError(INVALID_SESSION_MESSAGE);
      }

      await this.sessionsRepository.deleteAllByUserId(session.userId);
      this.authEvents.emitSessionsRevoked({ userId: session.userId });
      throw new UnauthorizedError(SESSION_REUSE_MESSAGE);
    }

    if (!isAfter(session.expiresAt, now)) {
      await this.sessionsRepository.deleteById(session.id);
      throw new UnauthorizedError(SESSION_EXPIRED_MESSAGE);
    }

    const user = await this.usersRepository.findById(session.userId);
    if (user === null) {
      throw new UnauthorizedError(INVALID_SESSION_MESSAGE);
    }

    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshHashNew = this.tokenService.hashRefreshToken(refreshToken);
    const expiresAt = session.expiresAt;

    await this.transactionRunner.run(async (tx) => {
      const rotated = await this.sessionsRepository.rotate(session.id, now, tx);
      if (rotated === 0) {
        throw new UnauthorizedError(SESSION_REUSE_MESSAGE);
      }

      await this.sessionsRepository.create(
        { expiresAt, refreshHash: refreshHashNew, userId: session.userId },
        tx,
      );
    });

    const accessToken = await this.tokenService.signAccessToken(user.id);

    return { expiresAt, refreshToken, result: { accessToken, user: toUserView(user) } };
  }

  async revoke(presentedToken: string): Promise<void> {
    const refreshHash = this.tokenService.hashRefreshToken(presentedToken);

    await this.sessionsRepository.deleteByRefreshHash(refreshHash);
  }
}
