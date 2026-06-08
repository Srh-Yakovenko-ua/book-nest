import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserModel } from "../../../generated/prisma/models.js";

import { SessionsRepository } from "../infrastructure/sessions.repository.js";
import { TokenService } from "./token.service.js";

type IssuedSession = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class SessionService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly tokenService: TokenService,
  ) {}

  async issue(user: UserModel, client?: Prisma.TransactionClient): Promise<IssuedSession> {
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshHash = this.tokenService.hashRefreshToken(refreshToken);
    const expiresAt = this.tokenService.refreshExpiry();

    await this.sessionsRepository.create({ expiresAt, refreshHash, userId: user.id }, client);

    const accessToken = await this.tokenService.signAccessToken(user.id);

    return { accessToken, refreshToken };
  }
}
