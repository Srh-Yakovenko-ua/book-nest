import { describe, expect, it } from "vitest";

import type {
  SeriesOrderDetectedIssue,
  SeriesOrderDetectionBook,
  SeriesOrderDetectionSeries,
} from "./series-order-detection.js";

import { computeQueueVersion } from "./queue-version.js";
import { detectSeriesOrderIssue, detectSeriesOrderIssues } from "./series-order-detection.js";
import { computeSeriesOrderFingerprint } from "./series-order-fingerprint.js";

function detectOrThrow(series: SeriesOrderDetectionSeries): SeriesOrderDetectedIssue {
  const issue = detectSeriesOrderIssue(series);
  if (issue === null) {
    throw new Error("expected a detected issue");
  }
  return issue;
}

function makeBook(overrides: Partial<SeriesOrderDetectionBook> = {}): SeriesOrderDetectionBook {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "book-default",
    ownershipStatus: "owned",
    partNumber: 1,
    queuePosition: null,
    readingStatus: "not_started",
    title: "Untitled",
    ...overrides,
  };
}

function makeSeries({
  books,
  id = "series-1",
  title = "Series",
}: {
  books: SeriesOrderDetectionBook[];
  id?: string;
  title?: string;
}): SeriesOrderDetectionSeries {
  return { books, id, title };
}

describe("detectSeriesOrderIssue problem types", () => {
  it("flags missing_previous_from_queue when one readable previous is not queued", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "p2", partNumber: 2, readingStatus: "not_started" }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1, readingStatus: "not_started" }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("missing_previous_from_queue");
    expect(issue.primary.severity).toBe("warning");
    expect(issue.primary.affectedBook.id).toBe("p3");
    expect(issue.primary.previousBook?.id).toBe("p2");
    expect(issue.primary.unresolvedPreviousCount).toBe(1);
    expect(issue.primary.allowedActions).toEqual([
      "ADD_NEXT_PREVIOUS_BEFORE",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
    expect(issue.addableBooks.map((book) => book.id)).toEqual(["p2"]);
  });

  it("flags previous_book_after_later_book when the earlier part sits lower in the queue", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", partNumber: 2, queuePosition: 8 }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 3 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("previous_book_after_later_book");
    expect(issue.primary.severity).toBe("error");
    expect(issue.primary.affectedBook.id).toBe("p3");
    expect(issue.primary.previousBook?.id).toBe("p2");
    expect(issue.primary.allowedActions).toEqual([
      "REORDER_SERIES_SLOTS",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
  });

  it("flags multiple_previous_missing when two or more readable previous are not queued", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "p2", partNumber: 2 }),
          makeBook({ id: "p3", partNumber: 3 }),
          makeBook({ id: "p4", partNumber: 4, queuePosition: 1 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("multiple_previous_missing");
    expect(issue.primary.severity).toBe("warning");
    expect(issue.primary.unresolvedPreviousCount).toBe(2);
    expect(issue.primary.allowedActions).toEqual([
      "ADD_NEXT_PREVIOUS_BEFORE",
      "ADD_ALL_PREVIOUS_BEFORE",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
    expect(issue.addableBooks.map((book) => book.id)).toEqual(["p2", "p3"]);
  });

  it("flags previous_book_paused when the missing previous is paused", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", partNumber: 2, readingStatus: "paused" }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("previous_book_paused");
    expect(issue.primary.severity).toBe("info");
    expect(issue.primary.allowedActions).toEqual([
      "RESUME_PREVIOUS_BOOK",
      "OPEN_PREVIOUS_BOOK",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
  });

  it("flags current_reading_ahead_of_order when a later part is being read", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", partNumber: 2, readingStatus: "not_started" }),
          makeBook({ id: "p3", partNumber: 3, readingStatus: "reading" }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("current_reading_ahead_of_order");
    expect(issue.primary.severity).toBe("error");
    expect(issue.primary.affectedBook.id).toBe("p3");
    expect(issue.primary.previousBook?.id).toBe("p2");
    expect(issue.primary.allowedActions).toEqual([
      "OPEN_PREVIOUS_BOOK",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
  });

  it("flags current_reading_ahead_of_order for a rereading later part", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", partNumber: 2, readingStatus: "not_started" }),
          makeBook({ id: "p3", partNumber: 3, readingStatus: "rereading" }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("current_reading_ahead_of_order");
  });

  it("flags previous_book_want_to_buy by the missing previous ownership", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", ownershipStatus: "want_to_buy", partNumber: 2 }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("previous_book_want_to_buy");
    expect(issue.primary.severity).toBe("warning");
    expect(issue.primary.allowedActions).toEqual([
      "OPEN_PURCHASE",
      "OPEN_PREVIOUS_BOOK",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
  });

  it("flags previous_book_not_owned when the missing previous ownership is none", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", ownershipStatus: "none", partNumber: 2 }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("previous_book_not_owned");
    expect(issue.primary.allowedActions).toEqual([
      "ADD_PREVIOUS_TO_WISHLIST",
      "OPEN_PREVIOUS_BOOK",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
  });

  it("flags previous_book_in_transit when the missing previous is in transit", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", ownershipStatus: "in_transit", partNumber: 2 }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("previous_book_in_transit");
    expect(issue.primary.allowedActions).toEqual([
      "OPEN_ORDER",
      "OPEN_PREVIOUS_BOOK",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
  });

  it("flags previous_book_lent_out when the missing previous is lent to someone", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", ownershipStatus: "lent_to_someone", partNumber: 2 }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("previous_book_lent_out");
    expect(issue.primary.allowedActions).toEqual([
      "OPEN_LOAN",
      "OPEN_PREVIOUS_BOOK",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
  });

  it("flags multiple_books_out_of_order for three jumbled queued parts", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1 }),
          makeBook({ id: "p2", partNumber: 2, queuePosition: 2 }),
          makeBook({ id: "p4", partNumber: 4, queuePosition: 3 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("multiple_books_out_of_order");
    expect(issue.primary.severity).toBe("error");
    expect(issue.primary.affectedBook.id).toBe("p3");
    expect(issue.primary.previousBook).toBeNull();
    expect(issue.primary.unresolvedPreviousCount).toBe(0);
    expect(issue.related).toHaveLength(0);
    expect(issue.primary.allowedActions).toEqual([
      "REORDER_SERIES_SLOTS",
      "IGNORE_ISSUE",
      "DISABLE_SERIES_CHECK",
    ]);
  });

  it("collapses a fully reversed queue into a single multiple_books_out_of_order", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p4", partNumber: 4, queuePosition: 1 }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 2 }),
          makeBook({ id: "p2", partNumber: 2, queuePosition: 3 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("multiple_books_out_of_order");
    expect(issue.primary.affectedBook.id).toBe("p4");
    expect(issue.related).toHaveLength(0);
  });
});

describe("detectSeriesOrderIssue non-conflicts", () => {
  it("does not flag a reading previous ahead of a queued later part", () => {
    const issue = detectSeriesOrderIssue(
      makeSeries({
        books: [
          makeBook({ id: "p2", partNumber: 2, readingStatus: "reading" }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1, readingStatus: "not_started" }),
        ],
      }),
    );

    expect(issue).toBeNull();
  });

  it("does not treat finished or dnf previous as blocking", () => {
    const issue = detectSeriesOrderIssue(
      makeSeries({
        books: [
          makeBook({ id: "p1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "p2", partNumber: 2, readingStatus: "dnf" }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1, readingStatus: "not_started" }),
        ],
      }),
    );

    expect(issue).toBeNull();
  });

  it("treats borrowed_from_someone as available, using missing rather than an ownership problem", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p2", ownershipStatus: "borrowed_from_someone", partNumber: 2 }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 1 }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("missing_previous_from_queue");
  });

  it("returns null when fewer than two parted books exist", () => {
    const issue = detectSeriesOrderIssue(
      makeSeries({
        books: [
          makeBook({ id: "p1", partNumber: 1, queuePosition: 1 }),
          makeBook({ id: "nb", partNumber: null, queuePosition: 2 }),
        ],
      }),
    );

    expect(issue).toBeNull();
  });

  it("does not invent a phantom previous for a gap in part numbers", () => {
    const issue = detectSeriesOrderIssue(
      makeSeries({
        books: [
          makeBook({ id: "p1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "p2", partNumber: 2, readingStatus: "finished" }),
          makeBook({ id: "p4", partNumber: 4, queuePosition: 1 }),
          makeBook({ id: "p5", partNumber: 5, queuePosition: 2 }),
        ],
      }),
    );

    expect(issue).toBeNull();
  });

  it("never uses a null part book as a previous", () => {
    const issue = detectSeriesOrderIssue(
      makeSeries({
        books: [
          makeBook({ id: "p1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "p2", partNumber: 2, queuePosition: 1, readingStatus: "not_started" }),
          makeBook({ id: "nb", partNumber: null, readingStatus: "not_started" }),
        ],
      }),
    );

    expect(issue).toBeNull();
  });

  it("does not flag a correctly ordered queue", () => {
    const issue = detectSeriesOrderIssue(
      makeSeries({
        books: [
          makeBook({ id: "p2", partNumber: 2, queuePosition: 1 }),
          makeBook({ id: "p3", partNumber: 3, queuePosition: 2 }),
          makeBook({ id: "p4", partNumber: 4, queuePosition: 3 }),
        ],
      }),
    );

    expect(issue).toBeNull();
  });
});

describe("detectSeriesOrderIssue grouping and ranking", () => {
  it("returns one grouped issue per series with the highest severity as primary", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "p2", partNumber: 2, readingStatus: "not_started" }),
          makeBook({ id: "p3", partNumber: 3, readingStatus: "reading" }),
          makeBook({ id: "p4", partNumber: 4, queuePosition: 1, readingStatus: "not_started" }),
        ],
      }),
    );

    expect(issue.primary.problemType).toBe("current_reading_ahead_of_order");
    expect(issue.primary.affectedBook.id).toBe("p3");
    expect(issue.related).toHaveLength(1);
    expect(issue.related[0]?.problemType).toBe("missing_previous_from_queue");
    expect(issue.related[0]?.affectedBook.id).toBe("p4");
  });

  it("collects queued and reading books into inPlayBooks", () => {
    const issue = detectOrThrow(
      makeSeries({
        books: [
          makeBook({ id: "p1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "p2", partNumber: 2, readingStatus: "not_started" }),
          makeBook({ id: "p3", partNumber: 3, readingStatus: "reading" }),
          makeBook({ id: "p4", partNumber: 4, queuePosition: 1, readingStatus: "not_started" }),
        ],
      }),
    );

    expect(issue.inPlayBooks.map((book) => book.id).sort()).toEqual(["p3", "p4"]);
  });
});

describe("detectSeriesOrderIssues across series", () => {
  it("ranks issues by primary priority then affected position", () => {
    const missingSeries = makeSeries({
      books: [
        makeBook({ id: "a2", partNumber: 2, readingStatus: "not_started" }),
        makeBook({ id: "a3", partNumber: 3, queuePosition: 5, readingStatus: "not_started" }),
      ],
      id: "series-a",
    });
    const readingSeries = makeSeries({
      books: [
        makeBook({ id: "b2", partNumber: 2, readingStatus: "not_started" }),
        makeBook({ id: "b3", partNumber: 3, readingStatus: "reading" }),
      ],
      id: "series-b",
    });

    const issues = detectSeriesOrderIssues([missingSeries, readingSeries]);

    expect(issues.map((issue) => issue.series.id)).toEqual(["series-b", "series-a"]);
  });

  it("breaks ties by series id and is stable across input order", () => {
    const first = makeSeries({
      books: [
        makeBook({ id: "x2", partNumber: 2, readingStatus: "not_started" }),
        makeBook({ id: "x3", partNumber: 3, queuePosition: 1, readingStatus: "not_started" }),
      ],
      id: "series-y",
    });
    const second = makeSeries({
      books: [
        makeBook({ id: "z2", partNumber: 2, readingStatus: "not_started" }),
        makeBook({ id: "z3", partNumber: 3, queuePosition: 1, readingStatus: "not_started" }),
      ],
      id: "series-x",
    });

    const ordered = detectSeriesOrderIssues([first, second]).map((issue) => issue.series.id);
    const reordered = detectSeriesOrderIssues([second, first]).map((issue) => issue.series.id);

    expect(ordered).toEqual(["series-x", "series-y"]);
    expect(reordered).toEqual(["series-x", "series-y"]);
  });

  it("drops series without an issue", () => {
    const clean = makeSeries({
      books: [
        makeBook({ id: "c2", partNumber: 2, queuePosition: 1 }),
        makeBook({ id: "c3", partNumber: 3, queuePosition: 2 }),
      ],
      id: "series-clean",
    });
    const conflicted = makeSeries({
      books: [
        makeBook({ id: "d2", partNumber: 2, readingStatus: "not_started" }),
        makeBook({ id: "d3", partNumber: 3, queuePosition: 1, readingStatus: "not_started" }),
      ],
      id: "series-conflicted",
    });

    const issues = detectSeriesOrderIssues([clean, conflicted]);

    expect(issues.map((issue) => issue.series.id)).toEqual(["series-conflicted"]);
  });
});

describe("computeSeriesOrderFingerprint", () => {
  function makeIssue(overrides: Partial<SeriesOrderDetectedIssue> = {}): SeriesOrderDetectedIssue {
    const previousBook = makeBook({ id: "prev", partNumber: 2, queuePosition: 1 });
    const affectedBook = makeBook({ id: "affected", partNumber: 3, queuePosition: 2 });
    return {
      addableBooks: [],
      inPlayBooks: [previousBook, affectedBook],
      primary: {
        affectedBook,
        allowedActions: ["REORDER_SERIES_SLOTS", "IGNORE_ISSUE", "DISABLE_SERIES_CHECK"],
        previousBook,
        problemType: "previous_book_after_later_book",
        severity: "error",
        unresolvedPreviousCount: 1,
      },
      related: [],
      series: { id: "series-1", title: "Series" },
      ...overrides,
    };
  }

  it("is deterministic and returns a sha256 hex digest", () => {
    const issue = makeIssue();

    const first = computeSeriesOrderFingerprint({ issue, userId: "user-1" });
    const second = computeSeriesOrderFingerprint({ issue, userId: "user-1" });

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stays stable when absolute queue positions shift but relative order is unchanged", () => {
    const baseSeries = makeSeries({
      books: [
        makeBook({ id: "p1", partNumber: 1, readingStatus: "not_started" }),
        makeBook({ id: "p2", partNumber: 2, queuePosition: 2 }),
        makeBook({ id: "p3", partNumber: 3, queuePosition: 4 }),
      ],
    });
    const shiftedSeries = makeSeries({
      books: [
        makeBook({ id: "p1", partNumber: 1, readingStatus: "not_started" }),
        makeBook({ id: "p2", partNumber: 2, queuePosition: 102 }),
        makeBook({ id: "p3", partNumber: 3, queuePosition: 104 }),
      ],
    });

    const base = computeSeriesOrderFingerprint({ issue: detectOrThrow(baseSeries), userId: "u" });
    const shifted = computeSeriesOrderFingerprint({
      issue: detectOrThrow(shiftedSeries),
      userId: "u",
    });

    expect(shifted).toBe(base);
  });

  it("changes when the user changes", () => {
    const issue = makeIssue();

    expect(computeSeriesOrderFingerprint({ issue, userId: "user-1" })).not.toBe(
      computeSeriesOrderFingerprint({ issue, userId: "user-2" }),
    );
  });

  it("changes when the problem type changes", () => {
    const base = computeSeriesOrderFingerprint({ issue: makeIssue(), userId: "u" });
    const changed = computeSeriesOrderFingerprint({
      issue: makeIssue({
        primary: {
          ...makeIssue().primary,
          problemType: "multiple_books_out_of_order",
        },
      }),
      userId: "u",
    });

    expect(changed).not.toBe(base);
  });

  it("changes when an in-play reading status changes", () => {
    const base = makeIssue();
    const changed = makeIssue({
      inPlayBooks: [
        makeBook({ id: "prev", partNumber: 2, queuePosition: 1, readingStatus: "paused" }),
        makeBook({ id: "affected", partNumber: 3, queuePosition: 2 }),
      ],
    });

    expect(computeSeriesOrderFingerprint({ issue: changed, userId: "u" })).not.toBe(
      computeSeriesOrderFingerprint({ issue: base, userId: "u" }),
    );
  });

  it("changes when an in-play ownership changes", () => {
    const base = makeIssue();
    const changed = makeIssue({
      inPlayBooks: [
        makeBook({ id: "prev", ownershipStatus: "want_to_buy", partNumber: 2, queuePosition: 1 }),
        makeBook({ id: "affected", partNumber: 3, queuePosition: 2 }),
      ],
    });

    expect(computeSeriesOrderFingerprint({ issue: changed, userId: "u" })).not.toBe(
      computeSeriesOrderFingerprint({ issue: base, userId: "u" }),
    );
  });

  it("changes when the relative queue order flips", () => {
    const base = makeIssue();
    const flipped = makeIssue({
      inPlayBooks: [
        makeBook({ id: "prev", partNumber: 2, queuePosition: 9 }),
        makeBook({ id: "affected", partNumber: 3, queuePosition: 1 }),
      ],
    });

    expect(computeSeriesOrderFingerprint({ issue: flipped, userId: "u" })).not.toBe(
      computeSeriesOrderFingerprint({ issue: base, userId: "u" }),
    );
  });

  it("changes when the affected or previous book changes", () => {
    const base = makeIssue();
    const otherPrevious = makeBook({ id: "prev-other", partNumber: 2, queuePosition: 1 });
    const changed = makeIssue({
      primary: { ...makeIssue().primary, previousBook: otherPrevious },
    });

    expect(computeSeriesOrderFingerprint({ issue: changed, userId: "u" })).not.toBe(
      computeSeriesOrderFingerprint({ issue: base, userId: "u" }),
    );
  });
});

describe("computeQueueVersion", () => {
  it("returns a deterministic 16-char hex token independent of input order", () => {
    const forward = computeQueueVersion([
      { id: "a", queuePosition: 1 },
      { id: "b", queuePosition: 2 },
    ]);
    const shuffled = computeQueueVersion([
      { id: "b", queuePosition: 2 },
      { id: "a", queuePosition: 1 },
    ]);

    expect(forward).toBe(shuffled);
    expect(forward).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when queue order changes", () => {
    const before = computeQueueVersion([
      { id: "a", queuePosition: 1 },
      { id: "b", queuePosition: 2 },
    ]);
    const after = computeQueueVersion([
      { id: "a", queuePosition: 2 },
      { id: "b", queuePosition: 1 },
    ]);

    expect(after).not.toBe(before);
  });

  it("changes when queue membership changes", () => {
    const before = computeQueueVersion([{ id: "a", queuePosition: 1 }]);
    const after = computeQueueVersion([
      { id: "a", queuePosition: 1 },
      { id: "b", queuePosition: 2 },
    ]);

    expect(after).not.toBe(before);
  });
});
