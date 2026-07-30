import type { Nullable } from "@app/shared";

import { addDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import type {
  LoanCandidateRow,
  ReminderRecipientRow,
} from "../infrastructure/reminder-candidates.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { ReminderCandidatesRepository } from "../infrastructure/reminder-candidates.repository.js";
import { NotificationRealtimePublisher } from "./notification-realtime.publisher.js";
import { NotificationReminderSweeper } from "./notification-reminder.sweeper.js";
import { NotificationWriterService } from "./notification-writer.service.js";
import { RecipientReminderSweeper } from "./recipient-reminder.sweeper.js";

const NINE_LOCAL_IN_KYIV = new Date("2026-07-30T06:00:00.000Z");
const NEXT_DAY_NINE_LOCAL_IN_KYIV = addDays(NINE_LOCAL_IN_KYIV, 1);
const DUE_IN_DEFAULT_LEAD = new Date("2026-08-02T00:00:00.000Z");
const DUE_BEYOND_DEFAULT_LEAD = new Date("2026-08-04T00:00:00.000Z");
const KYIV = "Europe/Kyiv";
const RECIPIENT_PAGE_SIZE = 200;
const CANDIDATE_PAGE_SIZE = 50;
const CANDIDATES_PER_RECIPIENT = 3;
const RECIPIENT_COUNT_WITH_TAIL = RECIPIENT_PAGE_SIZE + 50;

type SweeperHarness = {
  enqueueDigest: ReturnType<typeof vi.fn>;
  loadedCursors: Nullable<string>[];
  publishUnreadCount: ReturnType<typeof vi.fn>;
  sweeper: NotificationReminderSweeper;
  sweptUserIds: string[];
  write: ReturnType<typeof vi.fn>;
};

function buildHarness({
  candidatesPerRecipient = CANDIDATES_PER_RECIPIENT,
  expectedReturnDate = DUE_IN_DEFAULT_LEAD,
  failCandidatePagesAfterFirst = false,
  recipientCount,
}: {
  candidatesPerRecipient?: number;
  expectedReturnDate?: Date;
  failCandidatePagesAfterFirst?: boolean;
  recipientCount: number;
}): SweeperHarness {
  const recipients = buildRecipients(recipientCount);
  const loadedCursors: Nullable<string>[] = [];
  const sweptUserIds: string[] = [];
  const write = vi.fn().mockResolvedValue({ emailDeliveryCreated: true });
  const enqueueDigest = vi.fn().mockResolvedValue(undefined);
  const publishUnreadCount = vi.fn().mockResolvedValue(undefined);
  const writer = fakeOf<NotificationWriterService>({ enqueueDigest, write });

  const candidatesRepository = fakeOf<ReminderCandidatesRepository>({
    findDeliveryCandidates: () => Promise.resolve([]),
    findLoanCandidates: ({ afterId, userId }) => {
      if (afterId === null) {
        sweptUserIds.push(userId);
      }
      if (afterId !== null && failCandidatePagesAfterFirst) {
        return Promise.reject(new Error("connection terminated unexpectedly"));
      }
      return Promise.resolve(
        buildLoanCandidates({ afterId, candidatesPerRecipient, expectedReturnDate, userId }),
      );
    },
  });

  const sweeper = new NotificationReminderSweeper(
    fakeOf<ReminderCandidatesRepository>({
      findCandidateTimezones: () => Promise.resolve([KYIV]),
      findReminderRecipients: ({ afterUserId, limit }) => {
        loadedCursors.push(afterUserId);
        const start =
          afterUserId === null
            ? 0
            : recipients.findIndex((recipient) => recipient.id === afterUserId) + 1;
        return Promise.resolve(recipients.slice(start, start + limit));
      },
    }),
    fakeOf<NotificationRealtimePublisher>({ publishUnreadCount }),
    new RecipientReminderSweeper(candidatesRepository, writer),
    writer,
  );

  return { enqueueDigest, loadedCursors, publishUnreadCount, sweeper, sweptUserIds, write };
}

function buildLoanCandidates({
  afterId,
  candidatesPerRecipient,
  expectedReturnDate,
  userId,
}: {
  afterId: Nullable<string>;
  candidatesPerRecipient: number;
  expectedReturnDate: Date;
  userId: string;
}): LoanCandidateRow[] {
  const all = Array.from({ length: candidatesPerRecipient }, (_unused, index) => ({
    book: { id: `book-${userId}-${index}`, title: "Dune" },
    expectedReturnDate,
    id: `loan-${userId}-${String(index).padStart(4, "0")}`,
    loanDate: null,
    personName: "Paul",
  }));
  const start = afterId === null ? 0 : all.findIndex((candidate) => candidate.id === afterId) + 1;
  return all.slice(start, start + CANDIDATE_PAGE_SIZE);
}

function buildRecipients(count: number): ReminderRecipientRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
    id: `user-${String(index).padStart(4, "0")}`,
    settings: null,
  }));
}

describe("NotificationReminderSweeper recipient paging", () => {
  it("sweeps every recipient of the timezone within the single daily tick", async () => {
    const { loadedCursors, sweeper, sweptUserIds } = buildHarness({
      recipientCount: RECIPIENT_COUNT_WITH_TAIL,
    });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(sweptUserIds).toHaveLength(RECIPIENT_COUNT_WITH_TAIL);
    expect(sweptUserIds).toContain("user-0200");
    expect(sweptUserIds).toContain("user-0249");
    expect(loadedCursors).toEqual([null, "user-0199"]);
  });

  it("sweeps everyone when the recipient count is an exact multiple of the page size", async () => {
    const { sweeper, sweptUserIds } = buildHarness({ recipientCount: RECIPIENT_PAGE_SIZE });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(sweptUserIds).toHaveLength(RECIPIENT_PAGE_SIZE);

    sweptUserIds.length = 0;
    await sweeper.run({ now: NEXT_DAY_NINE_LOCAL_IN_KYIV });

    expect(sweptUserIds).toHaveLength(RECIPIENT_PAGE_SIZE);
    expect(sweptUserIds[0]).toBe("user-0000");
  });

  it("starts the next daily tick from the first recipient again", async () => {
    const { sweeper, sweptUserIds } = buildHarness({
      recipientCount: RECIPIENT_COUNT_WITH_TAIL,
    });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });
    sweptUserIds.length = 0;

    await sweeper.run({ now: NEXT_DAY_NINE_LOCAL_IN_KYIV });

    expect(sweptUserIds[0]).toBe("user-0000");
    expect(sweptUserIds).toHaveLength(RECIPIENT_COUNT_WITH_TAIL);
  });

  it("sweeps every candidate of a user beyond one candidate page", async () => {
    const candidatesPerRecipient = CANDIDATE_PAGE_SIZE + 10;
    const { sweeper, write } = buildHarness({ candidatesPerRecipient, recipientCount: 1 });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(write).toHaveBeenCalledTimes(candidatesPerRecipient);
  });

  it("enqueues exactly one digest per user no matter how many candidates fired", async () => {
    const recipientCount = 10;
    const { enqueueDigest, sweeper, write } = buildHarness({ recipientCount });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(write).toHaveBeenCalledTimes(recipientCount * CANDIDATES_PER_RECIPIENT);
    expect(enqueueDigest).toHaveBeenCalledTimes(recipientCount);
  });

  it("publishes exactly one unread count per user no matter how many candidates fired", async () => {
    const recipientCount = 10;
    const { publishUnreadCount, sweeper, write } = buildHarness({ recipientCount });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(write).toHaveBeenCalledTimes(recipientCount * CANDIDATES_PER_RECIPIENT);
    expect(publishUnreadCount).toHaveBeenCalledTimes(recipientCount);
    expect(publishUnreadCount).toHaveBeenCalledWith({ userId: "user-0000" });
  });

  it("keeps the publish and the digest of a page that committed before a later page failed", async () => {
    const { enqueueDigest, publishUnreadCount, sweeper, write } = buildHarness({
      candidatesPerRecipient: CANDIDATE_PAGE_SIZE + 10,
      failCandidatePagesAfterFirst: true,
      recipientCount: 1,
    });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(write).toHaveBeenCalledTimes(CANDIDATE_PAGE_SIZE);
    expect(publishUnreadCount).toHaveBeenCalledTimes(1);
    expect(enqueueDigest).toHaveBeenCalledTimes(1);
  });

  it("publishes nothing for a user whose candidates are due on no reminder day", async () => {
    const { publishUnreadCount, sweeper, write } = buildHarness({
      expectedReturnDate: DUE_BEYOND_DEFAULT_LEAD,
      recipientCount: 10,
    });

    await sweeper.run({ now: NINE_LOCAL_IN_KYIV });

    expect(write).not.toHaveBeenCalled();
    expect(publishUnreadCount).not.toHaveBeenCalled();
  });

  it("skips a sweep tick that overlaps the previous one", async () => {
    let releaseFirstLookup: (timezones: string[]) => void = () => undefined;
    const findCandidateTimezones = vi
      .fn()
      .mockResolvedValue([])
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            releaseFirstLookup = resolve;
          }),
      );

    const sweeper = new NotificationReminderSweeper(
      fakeOf<ReminderCandidatesRepository>({ findCandidateTimezones }),
      fakeOf<NotificationRealtimePublisher>({}),
      fakeOf<RecipientReminderSweeper>({}),
      fakeOf<NotificationWriterService>({}),
    );

    const firstTick = sweeper.sweep();
    await sweeper.sweep();

    expect(findCandidateTimezones).toHaveBeenCalledTimes(1);

    releaseFirstLookup([]);
    await firstTick;
    await sweeper.sweep();

    expect(findCandidateTimezones).toHaveBeenCalledTimes(2);
  });

  it("swallows a cron tick failure that the direct call still surfaces", async () => {
    const sweeper = new NotificationReminderSweeper(
      fakeOf<ReminderCandidatesRepository>({
        findCandidateTimezones: () => Promise.reject(new Error("db down")),
      }),
      fakeOf<NotificationRealtimePublisher>({}),
      fakeOf<RecipientReminderSweeper>({}),
      fakeOf<NotificationWriterService>({}),
    );

    await expect(sweeper.sweep()).resolves.toBeUndefined();
    await expect(sweeper.run({ now: NINE_LOCAL_IN_KYIV })).rejects.toThrow("db down");
  });
});
