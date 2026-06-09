import type { AuthResultView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { UnauthorizedError } from "../../../core/exceptions/errors.js";
import { toUserView } from "../domain/user.mapper.js";
import { SessionsRepository } from "../infrastructure/sessions.repository.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { TokenService } from "./token.service.js";

type IssuedSession = {
  accessToken: string;
  refreshToken: string;
};

type RefreshResult = {
  refreshToken: string;
  result: AuthResultView;
};

const INVALID_SESSION_MESSAGE = "Invalid session";
const SESSION_REUSE_MESSAGE = "Session reuse detected";
const SESSION_EXPIRED_MESSAGE = "Session expired";

@Injectable()
export class SessionService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(user: UserModel, client?: Prisma.TransactionClient): Promise<IssuedSession> {
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshHash = this.tokenService.hashRefreshToken(refreshToken);
    const expiresAt = this.tokenService.refreshExpiry();

    await this.sessionsRepository.create({ expiresAt, refreshHash, userId: user.id }, client);

    const accessToken = await this.tokenService.signAccessToken(user.id);

    return { accessToken, refreshToken };
  }

  async refresh(presentedToken: string): Promise<RefreshResult> {
    const now = new Date();
    const refreshHash = this.tokenService.hashRefreshToken(presentedToken);
    const session = await this.sessionsRepository.findByRefreshHash(refreshHash);

    if (session === null) {
      throw new UnauthorizedError(INVALID_SESSION_MESSAGE);
    }

    if (session.rotatedAt !== null) {
      await this.sessionsRepository.deleteAllByUserId(session.userId);
      throw new UnauthorizedError(SESSION_REUSE_MESSAGE);
    }

    if (session.expiresAt <= now) {
      await this.sessionsRepository.deleteById(session.id);
      throw new UnauthorizedError(SESSION_EXPIRED_MESSAGE);
    }

    const user = await this.usersRepository.findById(session.userId);
    if (user === null) {
      throw new UnauthorizedError(INVALID_SESSION_MESSAGE);
    }

    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshHashNew = this.tokenService.hashRefreshToken(refreshToken);
    const expiresAt = this.tokenService.refreshExpiry();

    await this.prisma.$transaction(async (tx) => {
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

    return { refreshToken, result: { accessToken, user: toUserView(user) } };
  }

  async revoke(presentedToken: string): Promise<void> {
    const refreshHash = this.tokenService.hashRefreshToken(presentedToken);

    await this.sessionsRepository.deleteByRefreshHash(refreshHash);
  }
}
