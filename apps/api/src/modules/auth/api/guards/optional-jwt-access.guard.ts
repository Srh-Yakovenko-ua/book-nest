import type { Nullable } from "@app/shared";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { Injectable } from "@nestjs/common";

import { TokenService } from "../../application/token.service.js";
import { toAuthenticatedUser } from "../../domain/authenticated-user.js";
import { UsersRepository } from "../../infrastructure/users.repository.js";

const BEARER_SCHEME = "bearer";

@Injectable()
export class OptionalJwtAccessGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = readBearerToken(request.headers.authorization);
    if (token === null) {
      return true;
    }

    const subject = await this.resolveSubject(token);
    if (subject === null) {
      return true;
    }

    const user = await this.usersRepository.findById(subject);
    if (user !== null) {
      request.currentUser = toAuthenticatedUser(user);
    }

    return true;
  }

  private async resolveSubject(token: string): Promise<Nullable<string>> {
    try {
      const { sub } = await this.tokenService.verifyAccessToken(token);
      return sub;
    } catch {
      return null;
    }
  }
}

function readBearerToken(header: string | undefined): Nullable<string> {
  if (header === undefined) {
    return null;
  }

  const [scheme, token, ...rest] = header.split(" ");
  if (
    rest.length !== 0 ||
    scheme === undefined ||
    scheme.toLowerCase() !== BEARER_SCHEME ||
    token === undefined ||
    token.length === 0
  ) {
    return null;
  }

  return token;
}
