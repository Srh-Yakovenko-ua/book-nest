import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { createParamDecorator } from "@nestjs/common";

import type { AuthenticatedUser } from "../../domain/authenticated-user.js";

import { UnauthorizedError } from "../../../../core/exceptions/errors.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const { currentUser } = context.switchToHttp().getRequest<Request>();
    if (currentUser === undefined) {
      throw new UnauthorizedError();
    }

    return currentUser;
  },
);
