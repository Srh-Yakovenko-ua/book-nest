import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import Redis from "ioredis";

import { env } from "../../config/env.js";

const REDIS_CLIENT = {
  commandTimeoutMs: 1_000,
  maxRetriesPerRequest: 3,
} as const;

@Injectable()
export class RedisService extends Redis implements OnApplicationShutdown {
  constructor() {
    super(env.redisUrl, {
      commandTimeout: REDIS_CLIENT.commandTimeoutMs,
      keyPrefix: env.redisKeyPrefix,
      lazyConnect: false,
      maxRetriesPerRequest: REDIS_CLIENT.maxRetriesPerRequest,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.status === "end") return;
    try {
      await this.quit();
    } catch {
      this.disconnect();
    }
  }
}
