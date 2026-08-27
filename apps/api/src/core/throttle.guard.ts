import type { ExecutionContext } from "@nestjs/common";

import { Injectable } from "@nestjs/common";
import { ThrottlerException, ThrottlerGuard } from "@nestjs/throttler";

import { createLogger } from "./logger.js";

const log = createLogger("throttle");

@Injectable()
export class StorageFailOpenThrottlerGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (error instanceof ThrottlerException) throw error;
      log.warn({ err: error }, "rate-limit storage unavailable, letting the request through");
      return true;
    }
  }
}
