import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { Injectable } from "@nestjs/common";

import { UnauthorizedError } from "../../../../core/exceptions/errors.js";
import { TokenService } from "../../application/token.service.js";
import { UsersRepository } from "../../infrastructure/users.repository.js";

const BEARER_SCHEME = "bearer";

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.headers.authorization);

    const { sub } = await this.tokenService.verifyAccessToken(token);

    const user = await this.usersRepository.findById(sub);
    if (user === null) {
      throw new UnauthorizedError("User not found");
    }

    request.currentUser = user;

    return true;
  }
}

function extractBearerToken(header: string | undefined): string {
  if (header === undefined) {
    throw new UnauthorizedError("Missing access token");
  }

  const [scheme, token, ...rest] = header.split(" ");
  if (
    rest.length !== 0 ||
    scheme === undefined ||
    scheme.toLowerCase() !== BEARER_SCHEME ||
    token === undefined ||
    token.length === 0
  ) {
    throw new UnauthorizedError("Missing access token");
  }

  return token;
}
