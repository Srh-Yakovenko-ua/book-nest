import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { createParamDecorator } from "@nestjs/common";

import type { AuthenticatedUser } from "../../domain/authenticated-user.js";

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    return context.switchToHttp().getRequest<Request>().currentUser;
  },
);
