import type { Nullable } from "@app/shared";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { Injectable } from "@nestjs/common";

import { AccessTokenAuthenticator } from "../../application/access-token.authenticator.js";

const BEARER_SCHEME = "bearer";

@Injectable()
export class OptionalJwtAccessGuard implements CanActivate {
  constructor(private readonly accessTokenAuthenticator: AccessTokenAuthenticator) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = readBearerToken(request.headers.authorization);
    if (token === null) {
      return true;
    }

    const session = await this.accessTokenAuthenticator.authenticate({ token });
    if (session !== null) {
      request.currentUser = session.user;
    }

    return true;
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
