import type { INestApplication } from "@nestjs/common";
import type { Job } from "bullmq";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { DigestMailStub } from "../../../test/digest-mail-stub.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { createDigestMailStub } from "../../../test/digest-mail-stub.js";
import { fakeOf } from "../../../test/fake.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { BOOK_PURGE_QUEUE_NAME } from "../../books/domain/book-purge.js";
import { NOTIFICATION_EMAIL_QUEUE_NAME } from "../domain/notification-email.js";
import { NotificationsModule } from "../notifications.module.js";
import { NotificationEmailProcessor } from "./notification-email.processor.js";
import { NotificationReminderSweeper } from "./notification-reminder.sweeper.js";

const NINE_LOCAL_IN_KYIV = new Date("2026-07-30T06:00:00.000Z");
const DUE_DATES = [
  new Date("2026-08-02T00:00:00.000Z"),
  new Date("2026-07-30T00:00:00.000Z"),
  new Date("2026-07-23T00:00:00.000Z"),
];

const bookQueueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

const enqueuedJobIds: string[] = [];
let runQueuedJob: (data: unknown) => Promise<void> = () => Promise.resolve();

const notificationQueueStub = {
  add: (_name: string, data: unknown, options: { jobId: string }): Promise<void> => {
    enqueuedJobIds.push(options.jobId);
    return runQueuedJob(data);
  },
  remove: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let digestMail: DigestMailStub;
let app: INestApplication;
let prisma: PrismaService;
let sweeper: NotificationReminderSweeper;

beforeAll(async () => {
  digestMail = createDigestMailStub();
  context = await createAuthTestContext(
    [AuthModule, NotificationsModule, BooksModule],
    [
      { provide: getQueueToken(BOOK_PURGE_QUEUE_NAME), useValue: bookQueueStub },
      { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE_NAME), useValue: notificationQueueStub },
      digestMail.override,
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  sweeper = app.get(NotificationReminderSweeper);

  const processor = app.get(NotificationEmailProcessor);
  runQueuedJob = (data) => processor.process(fakeOf<Job<unknown>>({ data }));
});

beforeEach(() => {
  context.reset();
  digestMail.reset();
  enqueuedJobIds.length = 0;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function createBook({ title, token }: { title: string; token: string }): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${token}`)
    .send({ authors: [{ name: "Frank Herbert" }], ownershipStatus: "owned", title });

  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

describe("notification digest fast path", () => {
  it("sends a single digest when the worker drains each enqueue as it lands", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    for (const [index, expectedReturnDate] of DUE_DATES.entries()) {
      const bookId = await createBook({ title: `Dune ${index}`, token: accessToken });
      await prisma.bookLoan.create({
        data: {
          bookId,
          expectedReturnDate,
          personName: "Paul Atreides",
          remindToReturn: true,
          status: "active",
          type: "lent_to_someone",
          userId,
        },
      });
    }

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(enqueuedJobIds).toEqual([`${userId}_2026-07-30T06`]);
    expect(digestMail.sent).toHaveLength(1);
    expect(digestMail.sent[0]?.items).toHaveLength(DUE_DATES.length);

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { notification: { userId } },
    });
    expect(deliveries).toHaveLength(DUE_DATES.length);
    expect(deliveries.every((delivery) => delivery.status === "sent")).toBe(true);
  });

  it("rejects a job payload that is not a user id", async () => {
    await expect(runQueuedJob({ userId: "not-a-uuid" })).rejects.toThrow();
    expect(digestMail.sent).toHaveLength(0);
  });
});
