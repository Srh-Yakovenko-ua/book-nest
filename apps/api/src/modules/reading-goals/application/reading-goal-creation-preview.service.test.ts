import type { Nullable, ReadingGoalCreationPreviewQuery } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { ListsService } from "../../lists/index.js";
import type { UserSettingsContextService } from "../../profile/index.js";
import type {
  ReadingGoalBooksRepository,
  ReadingGoalListBookEarliestFinishRow,
} from "../infrastructure/reading-goal-books.repository.js";
import type { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { fakeOf } from "../../../test/fake.js";
import { ReadingGoalCreationPreviewService } from "./reading-goal-creation-preview.service.js";
import { ReadingGoalInputValidator } from "./reading-goal-input.validator.js";

const PREVIEW = Object.freeze({
  dayAfterDeadline: "2026-03-16",
  deadline: "2026-03-15",
  listId: "22222222-2222-4222-8222-222222222222",
  timeZone: "Europe/Kyiv",
  today: "2026-03-10",
  tomorrow: "2026-03-11",
  userId: "11111111-1111-4111-8111-111111111111",
  yesterday: "2026-03-09",
});

function buildService(finishes: ReadingGoalListBookEarliestFinishRow[]) {
  const inputValidator = new ReadingGoalInputValidator(fakeOf<ReadingGoalBooksRepository>({}));
  const assertFutureDeadline = vi.spyOn(inputValidator, "assertFutureDeadline");

  const service = new ReadingGoalCreationPreviewService(
    fakeOf<ListsService>({ assertOwned: vi.fn().mockResolvedValue(undefined) }),
    fakeOf<UserSettingsContextService>({
      calendar: vi.fn().mockResolvedValue({
        timeZone: PREVIEW.timeZone,
        today: parseIsoDate(PREVIEW.today),
      }),
    }),
    inputValidator,
    fakeOf<ReadingGoalsRepository>({
      findActiveListBooks: vi
        .fn()
        .mockResolvedValue(finishes.map(({ bookId }, position) => ({ bookId, position }))),
    }),
    fakeOf<ReadingGoalBooksRepository>({
      findEarliestListBookFinishes: vi.fn().mockResolvedValue(finishes),
    }),
  );

  return { assertFutureDeadline, service };
}

function finishedOn(isoDates: Nullable<string>[]): ReadingGoalListBookEarliestFinishRow[] {
  return isoDates.map((isoDate, index) => ({
    bookId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`,
    finishedAt: isoDate === null ? null : parseIsoDate(isoDate),
  }));
}

function previewWith(
  service: ReadingGoalCreationPreviewService,
  query: ReadingGoalCreationPreviewQuery = {},
) {
  return service.preview({ listId: PREVIEW.listId, query, userId: PREVIEW.userId });
}

describe("ReadingGoalCreationPreviewService.preview without a deadline", () => {
  it("counts only the books finished on the reader's today", async () => {
    const { service } = buildService(
      finishedOn([PREVIEW.yesterday, PREVIEW.today, PREVIEW.tomorrow, null]),
    );

    await expect(previewWith(service)).resolves.toEqual({ bookCount: 4, countedCount: 1 });
  });

  it("skips the future-deadline check", async () => {
    const { assertFutureDeadline, service } = buildService(finishedOn([PREVIEW.today]));

    await previewWith(service);

    expect(assertFutureDeadline).not.toHaveBeenCalled();
  });
});

describe("ReadingGoalCreationPreviewService.preview with a deadline", () => {
  it("counts the books finished from today through the deadline day inclusive", async () => {
    const { service } = buildService(
      finishedOn([
        PREVIEW.yesterday,
        PREVIEW.today,
        PREVIEW.tomorrow,
        PREVIEW.deadline,
        PREVIEW.dayAfterDeadline,
        null,
      ]),
    );

    await expect(previewWith(service, { deadline: PREVIEW.deadline })).resolves.toEqual({
      bookCount: 6,
      countedCount: 3,
    });
  });

  it("checks the deadline against the reader's today", async () => {
    const { assertFutureDeadline, service } = buildService(finishedOn([PREVIEW.today]));

    await previewWith(service, { deadline: PREVIEW.deadline });

    expect(assertFutureDeadline).toHaveBeenCalledWith({
      deadline: PREVIEW.deadline,
      today: parseIsoDate(PREVIEW.today),
    });
  });

  it("rejects a deadline on the reader's today", async () => {
    const { service } = buildService(finishedOn([PREVIEW.today]));

    await expect(previewWith(service, { deadline: PREVIEW.today })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });
});
