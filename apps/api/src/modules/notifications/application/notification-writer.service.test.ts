import type { Queue } from "bullmq";

import { NOTIFICATION_TYPES } from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { NotificationModel } from "../../../generated/prisma/models.js";
import type { NotificationDraft } from "../domain/notification-draft.js";
import type { NotificationEmailJob } from "../domain/notification-email.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { fakeOf } from "../../../test/fake.js";
import { TEST_IDS } from "../../../test/ids.js";
import { NotificationDeliveriesRepository } from "../infrastructure/notification-deliveries.repository.js";
import { NotificationsRepository } from "../infrastructure/notifications.repository.js";
import { NotificationWriterService } from "./notification-writer.service.js";

const CREATED_AT = new Date("2026-07-30T06:00:00.000Z");
const NOW = new Date("2026-07-30T06:00:00.000Z");

type WriterHarness = {
  createPendingEmail: ReturnType<typeof vi.fn>;
  queueAdd: ReturnType<typeof vi.fn>;
  upsertByDedupeKey: ReturnType<typeof vi.fn>;
  writer: NotificationWriterService;
};

const notificationDraft: NotificationDraft = {
  dedupeKey: `loan:${TEST_IDS.book}:due_today`,
  entityId: TEST_IDS.book,
  entityType: "book",
  payload: {
    bookId: TEST_IDS.book,
    bookTitle: "Dune",
    dueDate: "2026-07-30",
    personName: "Paul",
    type: NOTIFICATION_TYPES.loanDueToday,
  },
  reason: "loan_opt_in",
  resetsReadState: false,
};

function buildHarness({ updatedAt }: { updatedAt: Date }): WriterHarness {
  const upsertByDedupeKey = vi.fn().mockResolvedValue(buildRow({ updatedAt }));
  const createPendingEmail = vi.fn().mockResolvedValue(undefined);
  const queueAdd = vi.fn().mockResolvedValue(undefined);

  const writer = new NotificationWriterService(
    fakeOf<NotificationDeliveriesRepository>({ createPendingEmail }),
    fakeOf<NotificationsRepository>({ upsertByDedupeKey }),
    fakeOf<TransactionRunner>({
      run: (fn) => fn(fakeOf<Prisma.TransactionClient>()),
    }),
    fakeOf<Queue<NotificationEmailJob>>({ add: queueAdd }),
  );

  return { createPendingEmail, queueAdd, upsertByDedupeKey, writer };
}

function buildRow({ updatedAt }: { updatedAt: Date }): NotificationModel {
  return fakeOf<NotificationModel>({
    createdAt: CREATED_AT,
    id: TEST_IDS.notification,
    updatedAt,
  });
}

describe("NotificationWriterService.write", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts on the dedupe key rather than inserting", async () => {
    const { upsertByDedupeKey, writer } = buildHarness({ updatedAt: CREATED_AT });

    await writer.write({
      emailPreferenceEnabled: false,
      emailVerified: true,
      notification: notificationDraft,
      userId: TEST_IDS.user,
    });

    expect(upsertByDedupeKey).toHaveBeenCalledTimes(1);
    expect(upsertByDedupeKey.mock.calls[0]?.[0]).toMatchObject({
      dedupeKey: notificationDraft.dedupeKey,
      level: "normal",
      params: {
        bookId: TEST_IDS.book,
        bookTitle: "Dune",
        dueDate: "2026-07-30",
        personName: "Paul",
      },
      reason: "loan_opt_in",
      resetsReadState: false,
      type: NOTIFICATION_TYPES.loanDueToday,
      userId: TEST_IDS.user,
    });
  });

  it("stores the discriminant in its own column and never inside params", async () => {
    const { upsertByDedupeKey, writer } = buildHarness({ updatedAt: CREATED_AT });

    await writer.write({
      emailPreferenceEnabled: false,
      emailVerified: false,
      notification: notificationDraft,
      userId: TEST_IDS.user,
    });

    expect(upsertByDedupeKey.mock.calls[0]?.[0].params).not.toHaveProperty("type");
  });

  it("creates an email delivery row for a newly created notification and never enqueues itself", async () => {
    const { createPendingEmail, queueAdd, writer } = buildHarness({ updatedAt: CREATED_AT });

    const result = await writer.write({
      emailPreferenceEnabled: true,
      emailVerified: true,
      notification: notificationDraft,
      userId: TEST_IDS.user,
    });

    expect(result).toEqual({ emailDeliveryCreated: true });
    expect(createPendingEmail).toHaveBeenCalledWith(
      { notificationId: TEST_IDS.notification },
      expect.anything(),
    );
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("creates no email delivery row when the upsert only refreshed an existing notification", async () => {
    const { createPendingEmail, writer } = buildHarness({
      updatedAt: new Date("2026-07-30T07:00:00.000Z"),
    });

    const result = await writer.write({
      emailPreferenceEnabled: true,
      emailVerified: true,
      notification: notificationDraft,
      userId: TEST_IDS.user,
    });

    expect(result).toEqual({ emailDeliveryCreated: false });
    expect(createPendingEmail).not.toHaveBeenCalled();
  });

  it("creates no email delivery row when the preference is off", async () => {
    const { createPendingEmail, writer } = buildHarness({ updatedAt: CREATED_AT });

    const result = await writer.write({
      emailPreferenceEnabled: false,
      emailVerified: true,
      notification: notificationDraft,
      userId: TEST_IDS.user,
    });

    expect(result).toEqual({ emailDeliveryCreated: false });
    expect(createPendingEmail).not.toHaveBeenCalled();
  });

  it("creates no email delivery row when the address is unverified", async () => {
    const { createPendingEmail, writer } = buildHarness({ updatedAt: CREATED_AT });

    const result = await writer.write({
      emailPreferenceEnabled: true,
      emailVerified: false,
      notification: notificationDraft,
      userId: TEST_IDS.user,
    });

    expect(result).toEqual({ emailDeliveryCreated: false });
    expect(createPendingEmail).not.toHaveBeenCalled();
  });
});

describe("NotificationWriterService.enqueueDigest", () => {
  it("collapses the digest job on a per-user, per-hour job id", async () => {
    const { queueAdd, writer } = buildHarness({ updatedAt: CREATED_AT });

    await writer.enqueueDigest({ now: NOW, userId: TEST_IDS.user });

    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd.mock.calls[0]?.[2]).toEqual({ jobId: `${TEST_IDS.user}_2026-07-30T06` });
  });

  it("builds a job id BullMQ accepts", async () => {
    const { queueAdd, writer } = buildHarness({ updatedAt: CREATED_AT });

    await writer.enqueueDigest({ now: NOW, userId: TEST_IDS.user });

    expect(queueAdd.mock.calls[0]?.[2].jobId).not.toContain(":");
  });

  it("swallows a queue outage so the notification still stands", async () => {
    const { queueAdd, writer } = buildHarness({ updatedAt: CREATED_AT });
    queueAdd.mockRejectedValue(new Error("redis down"));

    await expect(
      writer.enqueueDigest({ now: NOW, userId: TEST_IDS.user }),
    ).resolves.toBeUndefined();
  });
});
