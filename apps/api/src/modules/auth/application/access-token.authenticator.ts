import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { AuthenticatedSession } from "../domain/authenticated-user.js";

import { isAccessTokenStale } from "../domain/access-token-epoch.js";
import { toAuthenticatedUser } from "../domain/authenticated-user.js";
import { UsersRepository } from "../infrastructure/users.repository.js";
import { TokenService } from "./token.service.js";

@Injectable()
export class AccessTokenAuthenticator {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async authenticate({ token }: { token: string }): Promise<Nullable<AuthenticatedSession>> {
    let expiresAt: Date;
    let issuedAt: Date;
    let subject: string;
    try {
      ({ expiresAt, issuedAt, sub: subject } = await this.tokenService.verifyAccessToken(token));
    } catch {
      return null;
    }

    const user = await this.usersRepository.findById(subject);
    if (user === null) {
      return null;
    }

    if (isAccessTokenStale({ issuedAt, passwordChangedAt: user.passwordChangedAt })) {
      return null;
    }

    return { accessTokenExpiresAt: expiresAt, user: toAuthenticatedUser(user) };
  }
}
