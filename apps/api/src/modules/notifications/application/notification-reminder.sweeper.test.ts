import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { DigestMailStub } from "../../../test/digest-mail-stub.js";
import type { NotificationDraft } from "../domain/notification-draft.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { createDigestMailStub } from "../../../test/digest-mail-stub.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { BOOK_PURGE_QUEUE_NAME } from "../../books/domain/book-purge.js";
import { NOTIFICATION_EMAIL_QUEUE_NAME } from "../domain/notification-email.js";
import { NotificationDeliveriesRepository } from "../infrastructure/notification-deliveries.repository.js";
import { ReminderCandidatesRepository } from "../infrastructure/reminder-candidates.repository.js";
import { NotificationsModule } from "../notifications.module.js";
import { NotificationEmailDispatcher } from "./notification-email.dispatcher.js";
import { NotificationReminderSweeper } from "./notification-reminder.sweeper.js";
import { NotificationWriterService } from "./notification-writer.service.js";

const NINE_LOCAL_IN_KYIV = new Date("2026-07-30T06:00:00.000Z");
const MIDNIGHT_LOCAL_IN_KYIV = new Date("2026-07-29T21:00:00.000Z");
const DUE_IN_DEFAULT_LEAD = new Date("2026-08-02T00:00:00.000Z");
const DUE_TODAY = new Date("2026-07-30T00:00:00.000Z");
const OVERDUE_FIRST_STAGE = new Date("2026-07-23T00:00:00.000Z");
const UNRESOLVABLE_TIMEZONE = "Mars/Olympus";
const CONCURRENT_WRITE_ROUNDS = 5;
const LAST_ERROR_MAX = 500;

const bookQueueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

const notificationQueueStub = {
  add: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
};

let context: AuthTestContext;
let digestMail: DigestMailStub;
let app: INestApplication;
let prisma: PrismaService;
let sweeper: NotificationReminderSweeper;
let dispatcher: NotificationEmailDispatcher;

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
  dispatcher = app.get(NotificationEmailDispatcher);
});

beforeEach(() => {
  context.reset();
  digestMail.reset();
  notificationQueueStub.add.mockClear();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function createBook({
  title = "Dune",
  token,
}: {
  title?: string;
  token: string;
}): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${token}`)
    .send({ authors: [{ name: "Frank Herbert" }], ownershipStatus: "owned", title });

  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createLoan({
  bookId,
  expectedReturnDate = DUE_IN_DEFAULT_LEAD,
  remindToReturn = true,
  userId,
}: {
  bookId: string;
  expectedReturnDate?: Date;
  remindToReturn?: boolean;
  userId: string;
}): Promise<string> {
  const loan = await prisma.bookLoan.create({
    data: {
      bookId,
      expectedReturnDate,
      personName: "Paul Atreides",
      remindToReturn,
      status: "active",
      type: "lent_to_someone",
      userId,
    },
    select: { id: true },
  });
  return loan.id;
}

function readDeliveries(userId: string) {
  return prisma.notificationDelivery.findMany({ where: { notification: { userId } } });
}

function readNotifications(userId: string) {
  return prisma.notification.findMany({
    orderBy: { dedupeKey: "asc" },
    where: { userId },
  });
}

async function seedLoanCandidate(): Promise<{ bookId: string; loanId: string; userId: string }> {
  const { accessToken, userId } = await context.registerVerifyAndLogin();
  const bookId = await createBook({ token: accessToken });
  const loanId = await createLoan({ bookId, userId });
  return { bookId, loanId, userId };
}

describe("NotificationReminderSweeper", () => {
  it("creates one reminder for a loan due in exactly the default lead time", async () => {
    const { bookId, loanId, userId } = await seedLoanCandidate();

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    const notifications = await readNotifications(userId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      dedupeKey: `loan:${loanId}:due_soon`,
      entityId: bookId,
      entityType: "book",
      level: "normal",
      reason: "loan_opt_in",
      type: "loan.due_soon",
    });
    expect(notifications[0]?.params).toEqual({
      bookId,
      bookTitle: "Dune",
      dueDate: "2026-08-02",
      personName: "Paul Atreides",
    });
  });

  it("writes no second row when the same tick is swept again", async () => {
    const { userId } = await seedLoanCandidate();

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });
    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(await readNotifications(userId)).toHaveLength(1);
  });

  it("reminds a user who never opened the settings page", async () => {
    const { userId } = await seedLoanCandidate();
    expect(await prisma.userProfileSettings.count()).toBe(0);

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(await readNotifications(userId)).toHaveLength(1);
  });

  it("creates nothing for a loan whose book is in the trash", async () => {
    const { bookId, userId } = await seedLoanCandidate();
    await prisma.book.update({
      data: TRASH_RETENTION.stamp(),
      where: { id: bookId },
    });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(await readNotifications(userId)).toHaveLength(0);
  });

  it("creates nothing outside the send hour", async () => {
    const { userId } = await seedLoanCandidate();

    await sweeper.run({ now: MIDNIGHT_LOCAL_IN_KYIV });

    expect(await readNotifications(userId)).toHaveLength(0);
  });

  it("creates nothing for a loan that opted out of reminders", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook({ token: accessToken });
    await createLoan({ bookId, remindToReturn: false, userId });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(await readNotifications(userId)).toHaveLength(0);
  });

  it("skips a user whose stored timezone does not resolve without aborting the sweep", async () => {
    const reachable = await seedLoanCandidate();

    const stranded = await context.registerVerifyAndLogin();
    const strandedBookId = await createBook({ token: stranded.accessToken });
    await createLoan({ bookId: strandedBookId, userId: stranded.userId });
    await prisma.userProfileSettings.create({
      data: { timezone: UNRESOLVABLE_TIMEZONE, userId: stranded.userId },
    });

    const findUserIdsByTimezone = vi.spyOn(
      app.get(ReminderCandidatesRepository),
      "findUserIdsByTimezone",
    );

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(findUserIdsByTimezone).toHaveBeenCalledWith({ timezone: UNRESOLVABLE_TIMEZONE });
    await expect(findUserIdsByTimezone.mock.results[0]?.value).resolves.toEqual([stranded.userId]);
    expect(await readNotifications(stranded.userId)).toHaveLength(0);
    expect(await readNotifications(reachable.userId)).toHaveLength(1);
  });

  it("creates an email delivery row and enqueues the digest once for a verified user", async () => {
    const { userId } = await seedLoanCandidate();

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });
    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    const deliveries = await readDeliveries(userId);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ attempts: 0, channel: "email", status: "pending" });
    expect(notificationQueueStub.add).toHaveBeenCalledTimes(1);
  });

  it("enqueues one digest for a user with several reminders due in the same tick", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const dueDates = [DUE_IN_DEFAULT_LEAD, DUE_TODAY, OVERDUE_FIRST_STAGE];
    for (const [index, expectedReturnDate] of dueDates.entries()) {
      const bookId = await createBook({ title: `Dune ${index}`, token: accessToken });
      await createLoan({ bookId, expectedReturnDate, userId });
    }

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(await readNotifications(userId)).toHaveLength(3);
    expect(await readDeliveries(userId)).toHaveLength(3);
    expect(notificationQueueStub.add).toHaveBeenCalledTimes(1);

    await dispatcher.dispatchPending();

    expect(digestMail.sent).toHaveLength(1);
    expect(digestMail.sent[0]?.items).toHaveLength(3);
  });

  it("creates no email delivery row when the borrowed-book toggle is off", async () => {
    const { userId } = await seedLoanCandidate();
    await prisma.userProfileSettings.create({
      data: { borrowedBookReminders: false, userId },
    });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(await readNotifications(userId)).toHaveLength(1);
    expect(await prisma.notificationDelivery.count()).toBe(0);
    expect(notificationQueueStub.add).not.toHaveBeenCalled();
  });

  it("creates no email delivery row for an unverified address", async () => {
    const { userId } = await seedLoanCandidate();
    await prisma.user.update({ data: { emailVerifiedAt: null }, where: { id: userId } });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(await readNotifications(userId)).toHaveLength(1);
    expect(await prisma.notificationDelivery.count()).toBe(0);
  });

  it("hands the swept reminder to the hourly digest dispatcher", async () => {
    const { bookId, userId } = await seedLoanCandidate();

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });
    await dispatcher.dispatchPending();

    expect(digestMail.sent).toHaveLength(1);
    expect(digestMail.sent[0]).toMatchObject({
      items: [
        {
          bookId,
          bookTitle: "Dune",
          dueDate: "2026-08-02",
          personName: "Paul Atreides",
          type: "loan.due_soon",
        },
      ],
      locale: "uk",
    });

    const deliveries = await readDeliveries(userId);
    expect(deliveries[0]).toMatchObject({ attempts: 1, failedAt: null, status: "sent" });
    expect(deliveries[0]?.sentAt).toBeInstanceOf(Date);
  });

  it("records a failed send so the hourly backstop can retry it", async () => {
    const { userId } = await seedLoanCandidate();
    digestMail.failNext(new Error("550 5.1.1 <reader@example.com>: Recipient address rejected"));

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });
    await dispatcher.dispatchPending();

    const deliveries = await readDeliveries(userId);
    expect(deliveries[0]).toMatchObject({ attempts: 1, sentAt: null, status: "pending" });
    expect(deliveries[0]?.failedAt).toBeInstanceOf(Date);
    expect(deliveries[0]?.lastError).toBe(
      "550 5.1.1 <re***@example.com>: Recipient address rejected",
    );

    await dispatcher.dispatchPending();

    const retried = await readDeliveries(userId);
    expect(retried[0]).toMatchObject({ attempts: 2, status: "sent" });
    expect(digestMail.sent).toHaveLength(1);
  });

  it("caps an oversized provider error before it reaches the column", async () => {
    const { userId } = await seedLoanCandidate();
    digestMail.failNext(new Error("x".repeat(LAST_ERROR_MAX * 2)));

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });
    await dispatcher.dispatchPending();

    const deliveries = await readDeliveries(userId);
    expect(deliveries[0]?.lastError).toHaveLength(LAST_ERROR_MAX);
  });

  it("never resends a digest whose post-send bookkeeping failed", async () => {
    const { userId } = await seedLoanCandidate();
    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    vi.spyOn(app.get(NotificationDeliveriesRepository), "markSent").mockRejectedValueOnce(
      new Error("connection terminated unexpectedly"),
    );

    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();
    await dispatcher.dispatchPending();

    expect(digestMail.sent).toHaveLength(1);
    const deliveries = await readDeliveries(userId);
    expect(deliveries[0]).toMatchObject({ attempts: 1, status: "claimed" });
  });

  it("keeps one delivery row when two sweeps write the same reminder at once", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook({ token: accessToken });
    const writer = app.get(NotificationWriterService);

    for (let round = 0; round < CONCURRENT_WRITE_ROUNDS; round += 1) {
      const notification: NotificationDraft = {
        dedupeKey: `loan:${bookId}:round_${round}`,
        entityId: bookId,
        entityType: "book",
        payload: {
          bookId,
          bookTitle: "Dune",
          dueDate: "2026-07-30",
          personName: "Paul Atreides",
          type: "loan.due_today",
        },
        reason: "loan_opt_in",
        resetsReadState: false,
      };
      const input = {
        emailPreferenceEnabled: true,
        emailVerified: true,
        notification,
        userId,
      };

      const outcomes = await Promise.allSettled([writer.write(input), writer.write(input)]);
      expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "fulfilled"]);
    }

    expect(await readNotifications(userId)).toHaveLength(CONCURRENT_WRITE_ROUNDS);
    expect(await readDeliveries(userId)).toHaveLength(CONCURRENT_WRITE_ROUNDS);
  });

  it("creates a delivery reminder on the exact arriving-soon day", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook({ token: accessToken });
    const delivery = await prisma.bookDelivery.create({
      data: {
        bookId,
        expectedDeliveryDate: DUE_IN_DEFAULT_LEAD,
        status: "ordered",
        storeName: "Yakaboo",
        userId,
      },
      select: { id: true },
    });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    const notifications = await readNotifications(userId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      dedupeKey: `delivery:${delivery.id}:arriving_soon`,
      level: "passive",
      reason: "global_setting",
      type: "delivery.arriving_soon",
    });
    expect(notifications[0]?.params).toEqual({
      bookId,
      bookTitle: "Dune",
      expectedDate: "2026-08-02",
      storeName: "Yakaboo",
    });
  });

  it("still writes the delivery reminders when a loan write fails", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const loanBookId = await createBook({ title: "Dune 1", token: accessToken });
    await createLoan({ bookId: loanBookId, expectedReturnDate: DUE_TODAY, userId });
    const deliveryBookId = await createBook({ title: "Dune 2", token: accessToken });
    await prisma.bookDelivery.create({
      data: {
        bookId: deliveryBookId,
        expectedDeliveryDate: DUE_IN_DEFAULT_LEAD,
        status: "ordered",
        userId,
      },
    });

    vi.spyOn(app.get(NotificationWriterService), "write").mockRejectedValueOnce(
      new Error("write conflict"),
    );

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    const notifications = await readNotifications(userId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: "delivery.arriving_soon" });
  });
});
