import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { env } from "../../../../config/env.js";
import { ForbiddenError } from "../../../../core/exceptions/errors.js";
import { isTrustedOrigin } from "../../domain/trusted-origin.js";

const optionalHeader = z.string().optional().catch(undefined);

const OriginHeadersSchema = z.object({
  origin: optionalHeader,
  "sec-fetch-site": optionalHeader,
});

const CROSS_SITE_REJECTION = {
  code: "cross_site_request",
  message: "Cross-site request rejected",
} as const;

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const headers = OriginHeadersSchema.parse(request.headers);

    const trusted = isTrustedOrigin({
      origin: headers.origin,
      secFetchSite: headers["sec-fetch-site"],
      trustedOrigins: env.corsOrigins,
    });

    if (!trusted) {
      throw new ForbiddenError(CROSS_SITE_REJECTION.message, { code: CROSS_SITE_REJECTION.code });
    }

    return true;
  }
}
