import type { Nullable } from "@app/shared";

import { NOTIFICATION_TYPES } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ClaimedEmailDelivery,
  DigestRecipientRow,
  PendingEmailDelivery,
} from "../infrastructure/notification-deliveries.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { fakeOf } from "../../../test/fake.js";
import { TEST_IDS } from "../../../test/ids.js";
import { MailService } from "../../mail/index.js";
import { NotificationDeliveriesRepository } from "../infrastructure/notification-deliveries.repository.js";
import { NotificationEmailDispatcher } from "./notification-email.dispatcher.js";

const SMTP_REJECTION = "550 5.1.1 <reader@example.com>: Recipient address rejected";
const MAX_ATTEMPTS = 3;
const RECIPIENT_PAGE_SIZE = 100;

type DispatcherHarness = {
  claimForSend: ReturnType<typeof vi.fn>;
  dispatcher: NotificationEmailDispatcher;
  markFailed: ReturnType<typeof vi.fn>;
  markSent: ReturnType<typeof vi.fn>;
  sendNotificationDigestEmailOrThrow: ReturnType<typeof vi.fn>;
};

function buildDelivery(overrides: Partial<PendingEmailDelivery> = {}): PendingEmailDelivery {
  return {
    attempts: 0,
    id: TEST_IDS.delivery,
    notification: {
      id: TEST_IDS.notification,
      params: {
        bookId: TEST_IDS.book,
        bookTitle: "Dune",
        dueDate: "2026-07-30",
        personName: "Paul",
      },
      type: NOTIFICATION_TYPES.loanDueToday,
    },
    ...overrides,
  };
}

function buildHarness({
  claimed,
  deliveries,
  recipient,
  sendError,
}: {
  claimed?: ClaimedEmailDelivery[];
  deliveries: PendingEmailDelivery[];
  recipient: Nullable<DigestRecipientRow>;
  sendError?: Error;
}): DispatcherHarness {
  const claimForSend = vi
    .fn()
    .mockResolvedValue(
      claimed ??
        deliveries.map((delivery) => ({ attempts: delivery.attempts + 1, id: delivery.id })),
    );
  const markFailed = vi.fn().mockResolvedValue(undefined);
  const markSent = vi.fn().mockResolvedValue(undefined);
  const sendNotificationDigestEmailOrThrow =
    sendError === undefined
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(sendError);

  const dispatcher = new NotificationEmailDispatcher(
    fakeOf<NotificationDeliveriesRepository>({
      claimForSend,
      findPendingForUser: () => Promise.resolve(deliveries),
      findRecipient: () => Promise.resolve(recipient),
      markFailed,
      markSent,
    }),
    fakeOf<MailService>({ sendNotificationDigestEmailOrThrow }),
    fakeOf<TransactionRunner>({ run: (fn) => fn(fakeOf<Prisma.TransactionClient>()) }),
  );

  return { claimForSend, dispatcher, markFailed, markSent, sendNotificationDigestEmailOrThrow };
}

function buildRecipient(overrides: Partial<DigestRecipientRow> = {}): DigestRecipientRow {
  return {
    email: "reader@example.com",
    emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
    name: "Reader",
    settings: { language: "en" },
    ...overrides,
  };
}

describe("NotificationEmailDispatcher.dispatchForUser", () => {
  it("claims every delivery before handing it to the mailer", async () => {
    const { claimForSend, dispatcher, sendNotificationDigestEmailOrThrow } = buildHarness({
      deliveries: [buildDelivery()],
      recipient: buildRecipient(),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(claimForSend).toHaveBeenCalledTimes(1);
    expect(claimForSend.mock.calls[0]?.[0]).toMatchObject({
      ids: [TEST_IDS.delivery],
      maxAttempts: MAX_ATTEMPTS,
    });
    expect(claimForSend.mock.invocationCallOrder[0]).toBeLessThan(
      sendNotificationDigestEmailOrThrow.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("sends nothing when a competing dispatcher already claimed the batch", async () => {
    const { dispatcher, markSent, sendNotificationDigestEmailOrThrow } = buildHarness({
      claimed: [],
      deliveries: [buildDelivery()],
      recipient: buildRecipient(),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(sendNotificationDigestEmailOrThrow).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
  });

  it("sends only the deliveries it won the claim for", async () => {
    const otherDeliveryId = TEST_IDS.otherUser;
    const { dispatcher, markSent, sendNotificationDigestEmailOrThrow } = buildHarness({
      claimed: [{ attempts: 1, id: TEST_IDS.delivery }],
      deliveries: [buildDelivery(), buildDelivery({ id: otherDeliveryId })],
      recipient: buildRecipient(),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(sendNotificationDigestEmailOrThrow.mock.calls[0]?.[0].items).toHaveLength(1);
    expect(markSent.mock.calls[0]?.[0]).toMatchObject({ ids: [TEST_IDS.delivery] });
  });

  it("sends one digest carrying every pending payload and marks them sent", async () => {
    const { dispatcher, markSent, sendNotificationDigestEmailOrThrow } = buildHarness({
      deliveries: [buildDelivery()],
      recipient: buildRecipient(),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(sendNotificationDigestEmailOrThrow).toHaveBeenCalledTimes(1);
    expect(sendNotificationDigestEmailOrThrow.mock.calls[0]?.[0]).toMatchObject({
      items: [
        {
          bookId: TEST_IDS.book,
          bookTitle: "Dune",
          dueDate: "2026-07-30",
          personName: "Paul",
          type: NOTIFICATION_TYPES.loanDueToday,
        },
      ],
      locale: "en",
      to: "reader@example.com",
      userName: "Reader",
    });
    expect(markSent.mock.calls[0]?.[0]).toMatchObject({ ids: [TEST_IDS.delivery] });
    expect(markSent.mock.calls[0]?.[0].sentAt).toBeInstanceOf(Date);
  });

  it("records a failure with the message the provider gave", async () => {
    const { dispatcher, markFailed, markSent } = buildHarness({
      deliveries: [buildDelivery()],
      recipient: buildRecipient(),
      sendError: new Error(SMTP_REJECTION),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(markSent).not.toHaveBeenCalled();
    const failure = markFailed.mock.calls[0]?.[0];
    expect(failure).toMatchObject({ ids: [TEST_IDS.delivery], status: "pending" });
    expect(failure.failedAt).toBeInstanceOf(Date);
    expect(failure.lastError).toBe(SMTP_REJECTION);
  });

  it("gives up on a delivery once its claim consumed the last attempt", async () => {
    const { dispatcher, markFailed } = buildHarness({
      deliveries: [buildDelivery({ attempts: 2 })],
      recipient: buildRecipient(),
      sendError: new Error(SMTP_REJECTION),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(markFailed.mock.calls[0]?.[0]).toMatchObject({
      ids: [TEST_IDS.delivery],
      status: "failed",
    });
  });

  it("never sends to an unverified address", async () => {
    const { dispatcher, markFailed, sendNotificationDigestEmailOrThrow } = buildHarness({
      deliveries: [buildDelivery()],
      recipient: buildRecipient({ emailVerifiedAt: null }),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(sendNotificationDigestEmailOrThrow).not.toHaveBeenCalled();
    expect(markFailed.mock.calls[0]?.[0]).toMatchObject({ ids: [TEST_IDS.delivery] });
  });

  it("drops a delivery whose stored payload does not match its type", async () => {
    const { dispatcher, markFailed, sendNotificationDigestEmailOrThrow } = buildHarness({
      deliveries: [
        buildDelivery({
          notification: {
            id: TEST_IDS.notification,
            params: { unexpected: true },
            type: "loan.due_today",
          },
        }),
      ],
      recipient: buildRecipient(),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(sendNotificationDigestEmailOrThrow).not.toHaveBeenCalled();
    expect(markFailed.mock.calls[0]?.[0]).toMatchObject({
      ids: [TEST_IDS.delivery],
      status: "failed",
    });
  });

  it("falls back to the default language when the recipient has no settings row", async () => {
    const { dispatcher, sendNotificationDigestEmailOrThrow } = buildHarness({
      deliveries: [buildDelivery()],
      recipient: buildRecipient({ settings: null }),
    });

    await dispatcher.dispatchForUser({ userId: TEST_IDS.user });

    expect(sendNotificationDigestEmailOrThrow.mock.calls[0]?.[0].locale).toBe("uk");
  });
});

describe("NotificationEmailDispatcher.runBackstop", () => {
  it("skips a backstop tick that overlaps the previous one", async () => {
    let releaseFirstLookup: (userIds: string[]) => void = () => undefined;
    const findPendingRecipientIds = vi
      .fn()
      .mockResolvedValue([])
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            releaseFirstLookup = resolve;
          }),
      );

    const dispatcher = new NotificationEmailDispatcher(
      fakeOf<NotificationDeliveriesRepository>({ findPendingRecipientIds }),
      fakeOf<MailService>({}),
      fakeOf<TransactionRunner>({ run: (fn) => fn(fakeOf<Prisma.TransactionClient>()) }),
    );

    const firstTick = dispatcher.runBackstop();
    await dispatcher.runBackstop();

    expect(findPendingRecipientIds).toHaveBeenCalledTimes(1);

    releaseFirstLookup([]);
    await firstTick;
    await dispatcher.runBackstop();

    expect(findPendingRecipientIds).toHaveBeenCalledTimes(2);
  });

  it("swallows a cron tick failure that the direct call still surfaces", async () => {
    const dispatcher = new NotificationEmailDispatcher(
      fakeOf<NotificationDeliveriesRepository>({
        findPendingRecipientIds: () => Promise.reject(new Error("db down")),
      }),
      fakeOf<MailService>({}),
      fakeOf<TransactionRunner>({ run: (fn) => fn(fakeOf<Prisma.TransactionClient>()) }),
    );

    await expect(dispatcher.runBackstop()).resolves.toBeUndefined();
    await expect(dispatcher.dispatchPending()).rejects.toThrow("db down");
  });
});

describe("NotificationEmailDispatcher.dispatchPending", () => {
  it("pages through every pending recipient inside one tick", async () => {
    const recipientIds = Array.from(
      { length: RECIPIENT_PAGE_SIZE + 10 },
      (_unused, index) => `user-${String(index).padStart(4, "0")}`,
    );
    const requestedCursors: Nullable<string>[] = [];
    const findPendingRecipientIds = vi.fn(
      ({ afterUserId, limit }: { afterUserId: Nullable<string>; limit: number }) => {
        requestedCursors.push(afterUserId);
        const start = afterUserId === null ? 0 : recipientIds.indexOf(afterUserId) + 1;
        return Promise.resolve(recipientIds.slice(start, start + limit));
      },
    );

    const dispatcher = new NotificationEmailDispatcher(
      fakeOf<NotificationDeliveriesRepository>({
        findPendingForUser: () => Promise.resolve([]),
        findPendingRecipientIds,
      }),
      fakeOf<MailService>({}),
      fakeOf<TransactionRunner>({ run: (fn) => fn(fakeOf<Prisma.TransactionClient>()) }),
    );

    await dispatcher.dispatchPending();

    expect(requestedCursors).toEqual([
      null,
      `user-${String(RECIPIENT_PAGE_SIZE - 1).padStart(4, "0")}`,
    ]);
    expect(findPendingRecipientIds).toHaveBeenCalledTimes(2);
  });

  it("keeps dispatching the rest of the page when one recipient fails", async () => {
    const findPendingForUser = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection terminated"))
      .mockResolvedValue([]);

    const dispatcher = new NotificationEmailDispatcher(
      fakeOf<NotificationDeliveriesRepository>({
        findPendingForUser,
        findPendingRecipientIds: ({ afterUserId }) =>
          Promise.resolve(afterUserId === null ? [TEST_IDS.user, TEST_IDS.otherUser] : []),
      }),
      fakeOf<MailService>({}),
      fakeOf<TransactionRunner>({ run: (fn) => fn(fakeOf<Prisma.TransactionClient>()) }),
    );

    await expect(dispatcher.dispatchPending()).resolves.toBeUndefined();
    expect(findPendingForUser).toHaveBeenCalledTimes(2);
  });
});
