import type { SeriesOrderActionCode, SeriesOrderProblemType } from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  SeriesOrderConflict,
  SeriesOrderDetectedIssue,
  SeriesOrderDetectionBook,
} from "./series-order-detection.js";
import type { FixPlanQueueItem } from "./series-order-fix-plan.js";

import { computeFixPlan } from "./series-order-fix-plan.js";

const AFFECTED_SERIES_ID = "series-1";
const DEFAULT_QUEUE_LIMIT = 500;

function detectionBook(
  overrides: Partial<SeriesOrderDetectionBook> = {},
): SeriesOrderDetectionBook {
  return {
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    id: "book",
    ownershipStatus: "owned",
    partNumber: null,
    queuePosition: null,
    readingStatus: "not_started",
    title: "Book",
    ...overrides,
  };
}

function makeConflict(overrides: Partial<SeriesOrderConflict> = {}): SeriesOrderConflict {
  const problemType: SeriesOrderProblemType =
    overrides.problemType ?? "missing_previous_from_queue";
  const allowedActions: SeriesOrderActionCode[] = overrides.allowedActions ?? [
    "ADD_NEXT_PREVIOUS_BEFORE",
  ];
  return {
    affectedBook: overrides.affectedBook ?? detectionBook({ id: "affected" }),
    allowedActions,
    previousBook: overrides.previousBook ?? null,
    problemType,
    severity: overrides.severity ?? "warning",
    unresolvedPreviousCount: overrides.unresolvedPreviousCount ?? 1,
  };
}

function makeIssue(overrides: Partial<SeriesOrderDetectedIssue> = {}): SeriesOrderDetectedIssue {
  return {
    addableBooks: overrides.addableBooks ?? [],
    inPlayBooks: overrides.inPlayBooks ?? [],
    primary: overrides.primary ?? makeConflict(),
    related: overrides.related ?? [],
    series: overrides.series ?? { id: AFFECTED_SERIES_ID, title: "Dune" },
  };
}

function positionByBookId(items: { bookId: string; queuePosition: number }[]): Map<string, number> {
  return new Map(items.map((item) => [item.bookId, item.queuePosition]));
}

function queueItem(overrides: Partial<FixPlanQueueItem>): FixPlanQueueItem {
  return {
    bookId: "book",
    queuePosition: 1,
    seriesId: null,
    title: "Book",
    ...overrides,
  };
}

describe("computeFixPlan / ADD_NEXT_PREVIOUS_BEFORE", () => {
  it("inserts the next previous book immediately before the affected book and renumbers", () => {
    const affected = detectionBook({ id: "b3", partNumber: 3, queuePosition: 4, title: "Book 3" });
    const previous = detectionBook({ id: "b2", partNumber: 2, title: "Book 2" });
    const queue: FixPlanQueueItem[] = [
      queueItem({ bookId: "a", queuePosition: 1, title: "A" }),
      queueItem({ bookId: "b", queuePosition: 2, title: "B" }),
      queueItem({ bookId: "c", queuePosition: 3, title: "C" }),
      queueItem({ bookId: "b3", queuePosition: 4, seriesId: AFFECTED_SERIES_ID, title: "Book 3" }),
      queueItem({ bookId: "d", queuePosition: 5, title: "D" }),
    ];
    const issue = makeIssue({
      addableBooks: [previous],
      primary: makeConflict({ affectedBook: affected, previousBook: previous }),
    });

    const plan = computeFixPlan({
      issue,
      queue,
      queueLimit: DEFAULT_QUEUE_LIMIT,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });

    const afterPositions = positionByBookId(plan.after);
    expect(afterPositions.get("a")).toBe(1);
    expect(afterPositions.get("b")).toBe(2);
    expect(afterPositions.get("c")).toBe(3);
    expect(afterPositions.get("b2")).toBe(4);
    expect(afterPositions.get("b3")).toBe(5);
    expect(afterPositions.get("d")).toBe(6);

    expect(plan.after.map((item) => item.queuePosition)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan.addedBookIds).toEqual(["b2"]);
    expect(plan.movedBookIds).toEqual(expect.arrayContaining(["b3", "d"]));
    expect(plan.movedBookIds).not.toContain("a");
    expect(plan.shiftedUnrelatedBooksCount).toBe(1);
    expect(plan.limitExceeded).toBe(false);
    expect(plan.warnings).toEqual([]);

    const addChange = plan.changes.find((change) => change.bookId === "b2");
    expect(addChange).toMatchObject({ fromPosition: null, toPosition: 4, type: "add" });
  });

  it("flags limitExceeded and emits a warning without dropping the after preview", () => {
    const affected = detectionBook({ id: "b2", partNumber: 2, queuePosition: 1, title: "Book 2" });
    const previous = detectionBook({ id: "b1", partNumber: 1, title: "Book 1" });
    const queue: FixPlanQueueItem[] = [
      queueItem({ bookId: "b2", queuePosition: 1, seriesId: AFFECTED_SERIES_ID, title: "Book 2" }),
      queueItem({ bookId: "x", queuePosition: 2, title: "X" }),
      queueItem({ bookId: "y", queuePosition: 3, title: "Y" }),
    ];
    const issue = makeIssue({
      addableBooks: [previous],
      primary: makeConflict({ affectedBook: affected, previousBook: previous }),
    });

    const plan = computeFixPlan({
      issue,
      queue,
      queueLimit: 3,
      strategy: "ADD_NEXT_PREVIOUS_BEFORE",
    });

    expect(plan.limitExceeded).toBe(true);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.after).toHaveLength(4);
    expect(plan.addedBookIds).toEqual(["b1"]);
  });
});

describe("computeFixPlan / ADD_ALL_PREVIOUS_BEFORE", () => {
  it("inserts every addable book in canonical order before the affected book", () => {
    const affected = detectionBook({ id: "b3", partNumber: 3, queuePosition: 2, title: "Book 3" });
    const previousOne = detectionBook({ id: "b1", partNumber: 1, title: "Book 1" });
    const previousTwo = detectionBook({ id: "b2", partNumber: 2, title: "Book 2" });
    const queue: FixPlanQueueItem[] = [
      queueItem({ bookId: "a", queuePosition: 1, title: "A" }),
      queueItem({ bookId: "b3", queuePosition: 2, seriesId: AFFECTED_SERIES_ID, title: "Book 3" }),
      queueItem({ bookId: "d", queuePosition: 3, title: "D" }),
    ];
    const issue = makeIssue({
      addableBooks: [previousOne, previousTwo],
      primary: makeConflict({
        affectedBook: affected,
        allowedActions: ["ADD_NEXT_PREVIOUS_BEFORE", "ADD_ALL_PREVIOUS_BEFORE"],
        previousBook: previousOne,
        problemType: "multiple_previous_missing",
        unresolvedPreviousCount: 2,
      }),
    });

    const plan = computeFixPlan({
      issue,
      queue,
      queueLimit: DEFAULT_QUEUE_LIMIT,
      strategy: "ADD_ALL_PREVIOUS_BEFORE",
    });

    const afterPositions = positionByBookId(plan.after);
    expect(afterPositions.get("a")).toBe(1);
    expect(afterPositions.get("b1")).toBe(2);
    expect(afterPositions.get("b2")).toBe(3);
    expect(afterPositions.get("b3")).toBe(4);
    expect(afterPositions.get("d")).toBe(5);
    expect(plan.after.map((item) => item.queuePosition)).toEqual([1, 2, 3, 4, 5]);
    expect(plan.addedBookIds).toEqual(["b1", "b2"]);
    expect(plan.shiftedUnrelatedBooksCount).toBe(1);
  });
});

describe("computeFixPlan / REORDER_SERIES_SLOTS", () => {
  it("reassigns the series books to their own slots and leaves unrelated books untouched", () => {
    const bookThree = detectionBook({
      createdAt: new Date("2024-03-01T00:00:00.000Z"),
      id: "b3",
      partNumber: 3,
      queuePosition: 1,
      title: "Book 3",
    });
    const bookTwo = detectionBook({
      createdAt: new Date("2024-02-01T00:00:00.000Z"),
      id: "b2",
      partNumber: 2,
      queuePosition: 3,
      title: "Book 2",
    });
    const queue: FixPlanQueueItem[] = [
      queueItem({ bookId: "b3", queuePosition: 1, seriesId: AFFECTED_SERIES_ID, title: "Book 3" }),
      queueItem({ bookId: "soloA", queuePosition: 2, title: "Solo A" }),
      queueItem({ bookId: "b2", queuePosition: 3, seriesId: AFFECTED_SERIES_ID, title: "Book 2" }),
      queueItem({ bookId: "soloB", queuePosition: 4, title: "Solo B" }),
    ];
    const issue = makeIssue({
      inPlayBooks: [bookThree, bookTwo],
      primary: makeConflict({
        affectedBook: bookThree,
        allowedActions: ["REORDER_SERIES_SLOTS"],
        problemType: "previous_book_after_later_book",
      }),
    });

    const plan = computeFixPlan({
      issue,
      queue,
      queueLimit: DEFAULT_QUEUE_LIMIT,
      strategy: "REORDER_SERIES_SLOTS",
    });

    const afterPositions = positionByBookId(plan.after);
    expect(afterPositions.get("b2")).toBe(1);
    expect(afterPositions.get("soloA")).toBe(2);
    expect(afterPositions.get("b3")).toBe(3);
    expect(afterPositions.get("soloB")).toBe(4);

    expect(plan.addedBookIds).toEqual([]);
    expect(plan.movedBookIds).toEqual(expect.arrayContaining(["b2", "b3"]));
    expect(plan.movedBookIds).not.toContain("soloA");
    expect(plan.movedBookIds).not.toContain("soloB");
    expect(plan.shiftedUnrelatedBooksCount).toBe(0);
    expect(plan.warnings).toEqual([]);
  });

  it("fully reverses a series whose books are queued in descending part order", () => {
    const bookOne = detectionBook({
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      id: "b1",
      partNumber: 1,
      queuePosition: 3,
      title: "Book 1",
    });
    const bookTwo = detectionBook({
      createdAt: new Date("2024-02-01T00:00:00.000Z"),
      id: "b2",
      partNumber: 2,
      queuePosition: 2,
      title: "Book 2",
    });
    const bookThree = detectionBook({
      createdAt: new Date("2024-03-01T00:00:00.000Z"),
      id: "b3",
      partNumber: 3,
      queuePosition: 1,
      title: "Book 3",
    });
    const queue: FixPlanQueueItem[] = [
      queueItem({ bookId: "b3", queuePosition: 1, seriesId: AFFECTED_SERIES_ID, title: "Book 3" }),
      queueItem({ bookId: "b2", queuePosition: 2, seriesId: AFFECTED_SERIES_ID, title: "Book 2" }),
      queueItem({ bookId: "b1", queuePosition: 3, seriesId: AFFECTED_SERIES_ID, title: "Book 1" }),
    ];
    const issue = makeIssue({
      inPlayBooks: [bookOne, bookTwo, bookThree],
      primary: makeConflict({
        affectedBook: bookThree,
        allowedActions: ["REORDER_SERIES_SLOTS"],
        problemType: "multiple_books_out_of_order",
      }),
    });

    const plan = computeFixPlan({
      issue,
      queue,
      queueLimit: DEFAULT_QUEUE_LIMIT,
      strategy: "REORDER_SERIES_SLOTS",
    });

    const afterPositions = positionByBookId(plan.after);
    expect(afterPositions.get("b1")).toBe(1);
    expect(afterPositions.get("b2")).toBe(2);
    expect(afterPositions.get("b3")).toBe(3);
    expect(plan.after.map((item) => item.queuePosition)).toEqual([1, 2, 3]);
    expect(plan.movedBookIds).toEqual(expect.arrayContaining(["b1", "b3"]));
    expect(plan.movedBookIds).not.toContain("b2");
    expect(plan.shiftedUnrelatedBooksCount).toBe(0);
  });
});
