import type { INestApplication } from "@nestjs/common";

import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Controller, Get, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { seconds, Throttle, ThrottlerModule, type ThrottlerStorage } from "@nestjs/throttler";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { createTestApp } from "../../test/create-test-app.js";
import { deleteKeysUnderPrefix } from "../../test/redis-keys.js";
import { StorageFailOpenThrottlerGuard } from "../throttle.guard.js";
import { RedisModule } from "./redis.module.js";
import { RedisService } from "./redis.service.js";

const PROBE = {
  limit: 2,
  path: "/api/throttle-probe",
  ttlSeconds: 60,
} as const;

@Controller(PROBE.path)
class ThrottleProbeController {
  @Get()
  @Throttle({ default: { limit: PROBE.limit, ttl: seconds(PROBE.ttlSeconds) } })
  probe(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  controllers: [ThrottleProbeController],
  providers: [{ provide: APP_GUARD, useClass: StorageFailOpenThrottlerGuard }],
})
class ThrottleProbeModule {}

let app: INestApplication;

beforeEach(async () => {
  app = await createProbeApp();
  await deleteKeysUnderPrefix({ client: app.get(RedisService), prefix: env.redisKeyPrefix });
});

afterEach(async () => {
  await app.close();
});

function createProbeApp(storage?: ThrottlerStorage): Promise<INestApplication> {
  return createTestApp([
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        storage: storage ?? new ThrottlerStorageRedisService(redis),
        throttlers: [{ limit: PROBE.limit, ttl: seconds(PROBE.ttlSeconds) }],
      }),
    }),
    ThrottleProbeModule,
  ]);
}

const unreachableStorage: ThrottlerStorage = {
  increment: () => Promise.reject(new Error("redis unreachable")),
};

describe("throttler backed by redis storage", () => {
  it("serves the requests inside the window and rejects the one past the limit", async () => {
    const first = await request(app.getHttpServer()).get(PROBE.path);
    const second = await request(app.getHttpServer()).get(PROBE.path);
    const third = await request(app.getHttpServer()).get(PROBE.path);

    expect([first.status, second.status, third.status]).toEqual([200, 200, 429]);
  });

  it("carries the spent budget over to a second process instead of restarting it in memory", async () => {
    await request(app.getHttpServer()).get(PROBE.path);
    await request(app.getHttpServer()).get(PROBE.path);

    const secondProcess = await createProbeApp();
    const afterRestart = await request(secondProcess.getHttpServer()).get(PROBE.path);
    await secondProcess.close();

    expect(afterRestart.status).toBe(429);
  });

  it("lets the request through when the storage is unreachable instead of failing the route", async () => {
    const degraded = await createProbeApp(unreachableStorage);
    const res = await request(degraded.getHttpServer()).get(PROBE.path);
    await degraded.close();

    expect(res.status).toBe(200);
  });
});
