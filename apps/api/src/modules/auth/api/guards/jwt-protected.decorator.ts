import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { JwtAccessGuard } from "./jwt-access.guard.js";

export const JwtProtected = () =>
  applyDecorators(
    UseGuards(JwtAccessGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: "Missing or invalid access token" }),
  );
