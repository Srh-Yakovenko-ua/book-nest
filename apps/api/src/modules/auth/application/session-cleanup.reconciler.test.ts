import type { INestApplication } from "@nestjs/common";

import { addDays, subDays, subMinutes } from "date-fns";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../auth.module.js";
import { SESSION_CLEANUP, SessionCleanupReconciler } from "./session-cleanup.reconciler.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reconciler: SessionCleanupReconciler;

async function seedSession({
  expiresAt,
  refreshHash,
  rotatedAt = null,
  userId,
}: {
  expiresAt: Date;
  refreshHash: string;
  rotatedAt?: Date | null;
  userId: string;
}): Promise<void> {
  await prisma.session.create({ data: { expiresAt, refreshHash, rotatedAt, userId } });
}

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  reconciler = app.get(SessionCleanupReconciler);
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await app.close();
});

describe("SessionCleanupReconciler", () => {
  it("deletes expired sessions and keeps the live ones", async () => {
    const now = new Date();
    const { userId } = await context.registerVerifyAndLogin();
    await prisma.session.deleteMany({ where: { userId } });

    await seedSession({ expiresAt: subDays(now, 1), refreshHash: "expired", userId });
    await seedSession({ expiresAt: addDays(now, 1), refreshHash: "live", userId });

    const deleted = await reconciler.run({ now });

    expect(deleted).toBe(1);
    const surviving = await prisma.session.findMany({ select: { refreshHash: true } });
    expect(surviving.map((session) => session.refreshHash)).toEqual(["live"]);
  });

  it("takes the rotated tripwire rows with the chain once it expires", async () => {
    const now = new Date();
    const { userId } = await context.registerVerifyAndLogin();
    await prisma.session.deleteMany({ where: { userId } });

    await seedSession({
      expiresAt: subDays(now, 1),
      refreshHash: "rotated-and-expired",
      rotatedAt: subMinutes(now, 30),
      userId,
    });
    await seedSession({
      expiresAt: addDays(now, 1),
      refreshHash: "rotated-but-live",
      rotatedAt: subMinutes(now, 30),
      userId,
    });

    await reconciler.run({ now });

    const surviving = await prisma.session.findMany({ select: { refreshHash: true } });
    expect(surviving.map((session) => session.refreshHash)).toEqual(["rotated-but-live"]);
  });

  it("keeps deleting past a single batch so the backlog cannot outrun the sweep", async () => {
    const now = new Date();
    const { userId } = await context.registerVerifyAndLogin();
    await prisma.session.deleteMany({ where: { userId } });

    const expiredCount = SESSION_CLEANUP.batchSize + 1;
    await prisma.session.createMany({
      data: Array.from({ length: expiredCount }, (_, index) => ({
        expiresAt: subDays(now, 1),
        refreshHash: `expired-${index}`,
        userId,
      })),
    });

    const deleted = await reconciler.run({ now });

    expect(deleted).toBe(expiredCount);
    expect(await prisma.session.count()).toBe(0);
  });

  it("reports nothing to do on an empty table", async () => {
    expect(await reconciler.run({ now: new Date() })).toBe(0);
  });
});
