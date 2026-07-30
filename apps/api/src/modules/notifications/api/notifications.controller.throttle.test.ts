import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { GLOBAL_THROTTLE, MANUAL_TEST_NOTIFICATION_THROTTLE } from "../../../core/throttle.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { NOTIFICATION_EMAIL_QUEUE_NAME } from "../domain/notification-email.js";
import { NotificationsModule } from "../notifications.module.js";

const manualTestLimit = MANUAL_TEST_NOTIFICATION_THROTTLE.default.limit;

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

@Module({
  imports: [ThrottlerModule.forRoot([GLOBAL_THROTTLE])],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottledTestModule {}

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext(
    [ThrottledTestModule, AuthModule, NotificationsModule],
    [{ provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE_NAME), useValue: queueStub }],
  );
  app = context.app;
});

afterAll(async () => {
  await truncateAllTables(app);
  await context.close();
});

describe("POST /api/notifications/test", () => {
  it("stops accepting requests past its own tight limit", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    for (let attempt = 0; attempt < manualTestLimit; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/notifications/test")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(HttpStatus.ACCEPTED);
    }

    const blocked = await request(app.getHttpServer())
      .post("/api/notifications/test")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(blocked.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});
