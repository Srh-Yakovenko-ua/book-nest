import type { ReadingGoalRiskLevel, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { ActiveReadingGoalMembership } from "../../reading-goals/index.js";
import type {
  CancelledBookStateRow,
  CancelledSeriesRow,
} from "../infrastructure/cancelled-follow-up.repository.js";

import { buildCancelledPlanEntries, selectSeriesNextBookIds } from "./cancelled-follow-up.js";

const CANCELLED_AT = new Date("2026-08-10T10:00:00.000Z");

function makeGoal(
  overrides: Partial<ActiveReadingGoalMembership> = {},
): ActiveReadingGoalMembership {
  return {
    bookId: "book-1",
    goalId: "goal-1",
    goalName: "Осіннє читання",
    riskLevel: "none" as ReadingGoalRiskLevel,
    ...overrides,
  };
}

function makeRow(overrides: Partial<CancelledBookStateRow> = {}): CancelledBookStateRow {
  return {
    cancelledAt: CANCELLED_AT,
    cancelReason: null,
    hasActiveOrder: false,
    hasReceivedOrder: false,
    id: "book-1",
    inQueue: false,
    ownershipStatus: "none",
    seriesId: null,
    ...overrides,
  };
}

function makeSeries({
  books,
  id = "series-1",
  totalBooks = null,
}: {
  books: { id: string; partNumber: number; readingStatus?: ReadingStatus }[];
  id?: string;
  totalBooks?: null | number;
}): CancelledSeriesRow {
  return {
    books: books.map((book) => ({
      createdAt: CANCELLED_AT,
      id: book.id,
      partNumber: book.partNumber,
      readingStatus: book.readingStatus ?? "not_started",
    })),
    id,
    totalBooks,
  };
}

describe("selectSeriesNextBookIds", () => {
  it("takes the first unfinished part of a multi-book series", () => {
    const rows = [
      makeSeries({
        books: [
          { id: "part-1", partNumber: 1, readingStatus: "finished" },
          { id: "part-2", partNumber: 2 },
          { id: "part-3", partNumber: 3 },
        ],
      }),
    ];

    expect(selectSeriesNextBookIds(rows)).toEqual(new Set(["part-2"]));
  });

  it("leaves a one-book series without a next step", () => {
    const rows = [makeSeries({ books: [{ id: "only", partNumber: 1 }] })];

    expect(selectSeriesNextBookIds(rows)).toEqual(new Set());
  });

  it("counts a series the user is still reading through as pointing at that book", () => {
    const rows = [
      makeSeries({
        books: [
          { id: "part-1", partNumber: 1, readingStatus: "finished" },
          { id: "part-2", partNumber: 2, readingStatus: "reading" },
          { id: "part-3", partNumber: 3 },
        ],
      }),
    ];

    expect(selectSeriesNextBookIds(rows)).toEqual(new Set(["part-2"]));
  });
});

describe("buildCancelledPlanEntries", () => {
  it("leaves out a book no plan is waiting for", () => {
    const entries = buildCancelledPlanEntries({
      goals: [],
      rows: [makeRow()],
      seriesRows: [],
    });

    expect(entries).toEqual([]);
  });

  it("names the goal while the book belongs to exactly one", () => {
    const entries = buildCancelledPlanEntries({
      goals: [makeGoal({ riskLevel: "medium" })],
      rows: [makeRow()],
      seriesRows: [],
    });

    expect(entries[0]?.contexts).toEqual([
      { goalName: "Осіннє читання", goalsCount: 1, kind: "goal", riskLevel: "medium" },
    ]);
  });

  it("drops the name and keeps the strongest risk across several goals", () => {
    const entries = buildCancelledPlanEntries({
      goals: [
        makeGoal({ goalId: "goal-1", riskLevel: "low" }),
        makeGoal({ goalId: "goal-2", goalName: "Літній забіг", riskLevel: "high" }),
      ],
      rows: [makeRow()],
      seriesRows: [],
    });

    expect(entries[0]?.contexts).toEqual([
      { goalName: null, goalsCount: 2, kind: "goal", riskLevel: "high" },
    ]);
  });

  it("renders one book once with every context it touches", () => {
    const entries = buildCancelledPlanEntries({
      goals: [makeGoal({ bookId: "part-2" })],
      rows: [makeRow({ id: "part-2", inQueue: true, seriesId: "series-1" })],
      seriesRows: [
        makeSeries({
          books: [
            { id: "part-1", partNumber: 1, readingStatus: "finished" },
            { id: "part-2", partNumber: 2 },
          ],
        }),
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.contexts.map((context) => context.kind)).toEqual([
      "queue",
      "goal",
      "series_next",
    ]);
  });

  it("orders books by what the cancellation leaves standing", () => {
    const rows = [
      makeRow({ id: "queue-only", inQueue: true }),
      makeRow({ id: "goal-only" }),
      makeRow({ id: "goal-and-queue", inQueue: true }),
      makeRow({ id: "series-next", seriesId: "series-1" }),
      makeRow({ id: "goal-at-risk" }),
    ];
    const goals = [
      makeGoal({ bookId: "goal-only" }),
      makeGoal({ bookId: "goal-and-queue" }),
      makeGoal({ bookId: "goal-at-risk", riskLevel: "critical" }),
    ];
    const seriesRows = [
      makeSeries({
        books: [
          { id: "read-part", partNumber: 1, readingStatus: "finished" },
          { id: "series-next", partNumber: 2 },
        ],
      }),
    ];

    const entries = buildCancelledPlanEntries({ goals, rows, seriesRows });

    expect(entries.map((entry) => entry.id)).toEqual([
      "goal-at-risk",
      "series-next",
      "goal-and-queue",
      "goal-only",
      "queue-only",
    ]);
  });

  it("keeps the newest cancellation first when two books rank the same", () => {
    const rows = [
      makeRow({ cancelledAt: new Date("2026-08-12T10:00:00.000Z"), id: "newer", inQueue: true }),
      makeRow({ cancelledAt: new Date("2026-08-01T10:00:00.000Z"), id: "older", inQueue: true }),
    ];

    const entries = buildCancelledPlanEntries({ goals: [], rows, seriesRows: [] });

    expect(entries.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });
});
