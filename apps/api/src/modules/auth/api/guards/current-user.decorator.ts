import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { createParamDecorator } from "@nestjs/common";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<Request>().currentUser;
});
