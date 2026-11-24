import type { Nullable } from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { ActiveBookOrderKey } from "./active-book-order.js";

import { resolveActiveBookKey, sortActiveBooks, takeActiveBooksPage } from "./active-book-order.js";

const PAGE_SIZE = HOME_DASHBOARD_RULES.activeBooks.pageSize;

function activeBook({
  cycleStartedAt = null,
  index,
  lastProgressAt = null,
}: {
  cycleStartedAt?: Nullable<string>;
  index: number;
  lastProgressAt?: Nullable<string>;
}): ActiveBookOrderKey {
  return { id: uuidOf(index), key: resolveActiveBookKey({ cycleStartedAt, lastProgressAt }) };
}

function orderedBook(index: number, key: Nullable<string>): ActiveBookOrderKey {
  return { id: uuidOf(index), key };
}

function uuidOf(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const THIRTEEN_ORDERED_BOOKS: ActiveBookOrderKey[] = [
  orderedBook(1, "2026-11-23"),
  orderedBook(2, "2026-11-22"),
  orderedBook(3, "2026-11-21"),
  orderedBook(4, "2026-11-20"),
  orderedBook(5, "2026-11-19"),
  orderedBook(6, "2026-11-18"),
  orderedBook(7, "2026-11-18"),
  orderedBook(8, "2026-11-17"),
  orderedBook(9, "2026-11-16"),
  orderedBook(10, "2026-11-15"),
  orderedBook(11, "2026-11-14"),
  orderedBook(12, null),
  orderedBook(13, null),
];

function idsOf(books: readonly ActiveBookOrderKey[]): string[] {
  return books.map((book) => book.id);
}

function idsOfIndexes(indexes: readonly number[]): string[] {
  return indexes.map(uuidOf);
}

function withoutBook(books: readonly ActiveBookOrderKey[], index: number): ActiveBookOrderKey[] {
  return books.filter((book) => book.id !== uuidOf(index));
}

describe("resolveActiveBookKey", () => {
  it("keys a book by the latest progress date of its current cycle", () => {
    expect(
      resolveActiveBookKey({ cycleStartedAt: "2026-11-01", lastProgressAt: "2026-11-20" }),
    ).toBe("2026-11-20");
  });

  it("falls back to the current cycle start when the cycle has no progress", () => {
    expect(resolveActiveBookKey({ cycleStartedAt: "2026-11-01", lastProgressAt: null })).toBe(
      "2026-11-01",
    );
  });

  it("leaves the key unknown when neither date is known", () => {
    expect(resolveActiveBookKey({ cycleStartedAt: null, lastProgressAt: null })).toBeNull();
  });
});

describe("sortActiveBooks", () => {
  it("orders by the latest activity date descending, ties by id ascending, unknown last", () => {
    const startedWithoutProgress = activeBook({ cycleStartedAt: "2026-11-22", index: 31 });
    const progressedOnTheTwentieth = activeBook({
      cycleStartedAt: "2026-11-02",
      index: 30,
      lastProgressAt: "2026-11-20",
    });
    const progressedOnTheTwentiethLowerId = activeBook({
      cycleStartedAt: "2026-10-01",
      index: 21,
      lastProgressAt: "2026-11-20",
    });
    const progressedLongAgoButStartedLate = activeBook({
      cycleStartedAt: "2026-11-09",
      index: 5,
      lastProgressAt: "2026-11-10",
    });
    const unknownLowerId = activeBook({ index: 11 });
    const unknownHigherId = activeBook({ index: 40 });

    const sorted = sortActiveBooks([
      unknownHigherId,
      progressedOnTheTwentieth,
      progressedLongAgoButStartedLate,
      unknownLowerId,
      startedWithoutProgress,
      progressedOnTheTwentiethLowerId,
    ]);

    expect(idsOf(sorted)).toEqual(idsOfIndexes([31, 21, 30, 5, 11, 40]));
  });

  it("ranks a progress date above an earlier cycle start of another book", () => {
    const startedEarlier = activeBook({ cycleStartedAt: "2026-11-15", index: 1 });
    const progressedLater = activeBook({
      cycleStartedAt: "2026-11-01",
      index: 2,
      lastProgressAt: "2026-11-16",
    });

    expect(idsOf(sortActiveBooks([startedEarlier, progressedLater]))).toEqual(idsOfIndexes([2, 1]));
  });
});

describe("takeActiveBooksPage", () => {
  it("pages by six books", () => {
    expect(PAGE_SIZE).toBe(6);
  });

  it("returns the first six books and a cursor at the sixth when no cursor is given", () => {
    const page = takeActiveBooksPage({
      after: null,
      ordered: THIRTEEN_ORDERED_BOOKS,
      pageSize: PAGE_SIZE,
    });

    expect(idsOf(page.items)).toEqual(idsOfIndexes([1, 2, 3, 4, 5, 6]));
    expect(page.nextCursor).toEqual({ id: uuidOf(6), key: "2026-11-18" });
  });

  it("starts the next page strictly after a cursor book that shares its date", () => {
    const page = takeActiveBooksPage({
      after: { id: uuidOf(6), key: "2026-11-18" },
      ordered: THIRTEEN_ORDERED_BOOKS,
      pageSize: PAGE_SIZE,
    });

    expect(idsOf(page.items)).toEqual(idsOfIndexes([7, 8, 9, 10, 11, 12]));
    expect(page.nextCursor).toEqual({ id: uuidOf(12), key: null });
  });

  it("continues inside the unknown-date tail by id", () => {
    const page = takeActiveBooksPage({
      after: { id: uuidOf(12), key: null },
      ordered: THIRTEEN_ORDERED_BOOKS,
      pageSize: PAGE_SIZE,
    });

    expect(idsOf(page.items)).toEqual(idsOfIndexes([13]));
  });

  it("returns a null cursor on the last page", () => {
    const page = takeActiveBooksPage({
      after: { id: uuidOf(12), key: null },
      ordered: THIRTEEN_ORDERED_BOOKS,
      pageSize: PAGE_SIZE,
    });

    expect(page.nextCursor).toBeNull();
  });

  it("returns a null cursor when the last page is exactly full", () => {
    const page = takeActiveBooksPage({
      after: { id: uuidOf(6), key: "2026-11-18" },
      ordered: THIRTEEN_ORDERED_BOOKS.slice(0, 12),
      pageSize: PAGE_SIZE,
    });

    expect(idsOf(page.items)).toEqual(idsOfIndexes([7, 8, 9, 10, 11, 12]));
    expect(page.nextCursor).toBeNull();
  });

  it("returns a null cursor when every book fits on the first page", () => {
    const page = takeActiveBooksPage({
      after: null,
      ordered: THIRTEEN_ORDERED_BOOKS.slice(0, 4),
      pageSize: PAGE_SIZE,
    });

    expect(idsOf(page.items)).toEqual(idsOfIndexes([1, 2, 3, 4]));
    expect(page.nextCursor).toBeNull();
  });

  it("yields no duplicates and no gaps when the cursor book is removed between pages", () => {
    const firstPage = takeActiveBooksPage({
      after: null,
      ordered: THIRTEEN_ORDERED_BOOKS,
      pageSize: PAGE_SIZE,
    });
    const afterRemoval = withoutBook(THIRTEEN_ORDERED_BOOKS, 6);
    const secondPage = takeActiveBooksPage({
      after: firstPage.nextCursor,
      ordered: afterRemoval,
      pageSize: PAGE_SIZE,
    });
    const thirdPage = takeActiveBooksPage({
      after: secondPage.nextCursor,
      ordered: afterRemoval,
      pageSize: PAGE_SIZE,
    });

    const walked = [firstPage, secondPage, thirdPage].flatMap((page) => idsOf(page.items));

    expect(walked).toEqual(idsOfIndexes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]));
    expect(thirdPage.nextCursor).toBeNull();
  });

  it("continues after a removed cursor book whose date was unknown", () => {
    const page = takeActiveBooksPage({
      after: { id: uuidOf(12), key: null },
      ordered: withoutBook(THIRTEEN_ORDERED_BOOKS, 12),
      pageSize: PAGE_SIZE,
    });

    expect(idsOf(page.items)).toEqual(idsOfIndexes([13]));
  });
});
