import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { subDays, subHours } from "date-fns";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { NOTIFICATION_EMAIL_QUEUE_NAME } from "../domain/notification-email.js";
import { NotificationsModule } from "../notifications.module.js";
import {
  NOTIFICATION_RETENTION,
  NotificationPurgeReconciler,
} from "./notification-purge.reconciler.js";

const RETENTION_OVERSHOOT_DAYS = 1;

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reconciler: NotificationPurgeReconciler;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, NotificationsModule],
    [{ provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE_NAME), useValue: queueStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  reconciler = app.get(NotificationPurgeReconciler);
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function seedNotification({
  createdAt,
  dedupeKey,
  userId,
}: {
  createdAt: Date;
  dedupeKey: string;
  userId: string;
}): Promise<string> {
  const notification = await prisma.notification.create({
    data: {
      createdAt,
      dedupeKey,
      level: "normal",
      params: { requestedAt: createdAt.toISOString() },
      reason: "manual_test",
      type: "system.test",
      userId,
    },
    select: { id: true },
  });
  return notification.id;
}

describe("NotificationPurgeReconciler", () => {
  it("deletes notifications past the retention window with their delivery rows and keeps the rest", async () => {
    const { userId } = await context.registerVerifyAndLogin();
    const now = new Date();

    const expiredId = await seedNotification({
      createdAt: subDays(now, NOTIFICATION_RETENTION.days + RETENTION_OVERSHOOT_DAYS),
      dedupeKey: "test:expired",
      userId,
    });
    const survivingId = await seedNotification({
      createdAt: subHours(now, 1),
      dedupeKey: "test:surviving",
      userId,
    });

    await prisma.notificationDelivery.create({
      data: { channel: "email", notificationId: expiredId, status: "pending" },
    });
    await prisma.notificationDelivery.create({
      data: { channel: "email", notificationId: survivingId, status: "pending" },
    });

    await reconciler.sweep();

    const remaining = await prisma.notification.findMany({ select: { id: true } });
    expect(remaining).toEqual([{ id: survivingId }]);

    const remainingDeliveries = await prisma.notificationDelivery.findMany({
      select: { notificationId: true },
    });
    expect(remainingDeliveries).toEqual([{ notificationId: survivingId }]);
  });

  it("keeps a notification sitting exactly inside the retention window", async () => {
    const { userId } = await context.registerVerifyAndLogin();

    await seedNotification({
      createdAt: subDays(new Date(), NOTIFICATION_RETENTION.days - RETENTION_OVERSHOOT_DAYS),
      dedupeKey: "test:inside-window",
      userId,
    });

    await reconciler.sweep();

    expect(await prisma.notification.count()).toBe(1);
  });
});
