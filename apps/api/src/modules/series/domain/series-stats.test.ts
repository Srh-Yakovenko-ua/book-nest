import type { Nullable, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import { computeSeriesStats } from "./series-stats.js";

type StatsBook = {
  createdAt: Date;
  finishedAt: Nullable<Date>;
  id: string;
  isFavorite: boolean;
  pagesCount: Nullable<number>;
  partNumber: Nullable<number>;
  rating: Nullable<number>;
  readingStatus: ReadingStatus;
  startedAt: Nullable<Date>;
  title: string;
};

function makeBook(overrides: Partial<StatsBook> = {}): StatsBook {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    finishedAt: null,
    id: "book-id",
    isFavorite: false,
    pagesCount: null,
    partNumber: null,
    rating: null,
    readingStatus: "not_started",
    startedAt: null,
    title: "Book title",
    ...overrides,
  };
}

describe("computeSeriesStats counts", () => {
  it("counts the total and finished books", () => {
    const stats = computeSeriesStats([
      makeBook({ readingStatus: "finished" }),
      makeBook({ readingStatus: "finished" }),
      makeBook({ readingStatus: "reading" }),
      makeBook({ readingStatus: "not_started" }),
    ]);

    expect(stats.booksCount).toBe(4);
    expect(stats.finishedCount).toBe(2);
  });

  it("counts reading and rereading books together as reading", () => {
    const stats = computeSeriesStats([
      makeBook({ readingStatus: "reading" }),
      makeBook({ readingStatus: "rereading" }),
      makeBook({ readingStatus: "finished" }),
    ]);

    expect(stats.readingCount).toBe(2);
  });

  it("counts every book that is neither finished nor being read as unread", () => {
    const stats = computeSeriesStats([
      makeBook({ readingStatus: "not_started" }),
      makeBook({ readingStatus: "want_to_read" }),
      makeBook({ readingStatus: "paused" }),
      makeBook({ readingStatus: "dnf" }),
      makeBook({ readingStatus: "finished" }),
      makeBook({ readingStatus: "reading" }),
      makeBook({ readingStatus: "rereading" }),
    ]);

    expect(stats.unreadCount).toBe(4);
  });
});

describe("computeSeriesStats averageRating", () => {
  it("averages only the rated books and rounds to one decimal", () => {
    const stats = computeSeriesStats([
      makeBook({ rating: 7 }),
      makeBook({ rating: 8 }),
      makeBook({ rating: 8 }),
      makeBook({ rating: null }),
    ]);

    expect(stats.averageRating).toBe(7.7);
  });

  it("returns a null average when no book carries a rating", () => {
    const stats = computeSeriesStats([makeBook({ rating: null }), makeBook({ rating: null })]);

    expect(stats.averageRating).toBeNull();
  });
});

describe("computeSeriesStats pagesCount", () => {
  it("sums the page counts of the books that have one", () => {
    const stats = computeSeriesStats([
      makeBook({ pagesCount: 100 }),
      makeBook({ pagesCount: 200 }),
      makeBook({ pagesCount: null }),
    ]);

    expect(stats.pagesCount).toBe(300);
  });

  it("returns a null page count when no book has one", () => {
    const stats = computeSeriesStats([
      makeBook({ pagesCount: null }),
      makeBook({ pagesCount: null }),
    ]);

    expect(stats.pagesCount).toBeNull();
  });
});

describe("computeSeriesStats readPagesCount and readPagesPartial", () => {
  it("sums the pages of finished books that have them and reports a complete sum", () => {
    const stats = computeSeriesStats([
      makeBook({ pagesCount: 300, readingStatus: "finished" }),
      makeBook({ pagesCount: 200, readingStatus: "finished" }),
      makeBook({ pagesCount: 150, readingStatus: "reading" }),
    ]);

    expect(stats.readPagesCount).toBe(500);
    expect(stats.readPagesPartial).toBe(false);
  });

  it("sums only the finished books and flags the sum partial when a finished book lacks pages", () => {
    const stats = computeSeriesStats([
      makeBook({ pagesCount: 400, readingStatus: "finished" }),
      makeBook({ pagesCount: null, readingStatus: "finished" }),
    ]);

    expect(stats.readPagesCount).toBe(400);
    expect(stats.readPagesPartial).toBe(true);
  });

  it("returns a null read page count and a non-partial flag when no finished book has pages", () => {
    const stats = computeSeriesStats([
      makeBook({ pagesCount: null, readingStatus: "finished" }),
      makeBook({ pagesCount: 300, readingStatus: "reading" }),
    ]);

    expect(stats.readPagesCount).toBeNull();
    expect(stats.readPagesPartial).toBe(false);
  });

  it("returns a null read page count and a non-partial flag when no book is finished", () => {
    const stats = computeSeriesStats([
      makeBook({ pagesCount: 300, readingStatus: "reading" }),
      makeBook({ pagesCount: 200, readingStatus: "not_started" }),
    ]);

    expect(stats.readPagesCount).toBeNull();
    expect(stats.readPagesPartial).toBe(false);
  });
});

describe("computeSeriesStats averagePages", () => {
  it("averages the pages of every book that has one and rounds to the nearest integer", () => {
    const stats = computeSeriesStats([
      makeBook({ pagesCount: 100 }),
      makeBook({ pagesCount: 201 }),
      makeBook({ pagesCount: null }),
    ]);

    expect(stats.averagePages).toBe(151);
  });

  it("returns a null average when no book has a page count", () => {
    const stats = computeSeriesStats([
      makeBook({ pagesCount: null }),
      makeBook({ pagesCount: null }),
    ]);

    expect(stats.averagePages).toBeNull();
  });
});

describe("computeSeriesStats favoriteBook", () => {
  it("returns the first favorite in reading order rather than the highest rated", () => {
    const stats = computeSeriesStats([
      makeBook({ id: "fav-part-2", isFavorite: true, partNumber: 2, rating: 10, title: "Second" }),
      makeBook({ id: "fav-part-1", isFavorite: true, partNumber: 1, rating: 5, title: "First" }),
      makeBook({
        id: "fav-part-null",
        isFavorite: true,
        partNumber: null,
        rating: 9,
        title: "Companion",
      }),
    ]);

    expect(stats.favoriteBook).toEqual({ id: "fav-part-1", title: "First" });
  });

  it("sorts a favorite without a part number after numbered favorites", () => {
    const stats = computeSeriesStats([
      makeBook({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "companion",
        isFavorite: true,
        partNumber: null,
        title: "Companion",
      }),
      makeBook({
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        id: "part-3",
        isFavorite: true,
        partNumber: 3,
        title: "Part Three",
      }),
    ]);

    expect(stats.favoriteBook).toEqual({ id: "part-3", title: "Part Three" });
  });

  it("returns a null favorite book when no book is marked favorite", () => {
    const stats = computeSeriesStats([
      makeBook({ isFavorite: false }),
      makeBook({ isFavorite: false }),
    ]);

    expect(stats.favoriteBook).toBeNull();
  });
});

describe("computeSeriesStats reading window", () => {
  it("reports the earliest start, latest finish, and their calendar-day span", () => {
    const stats = computeSeriesStats([
      makeBook({
        finishedAt: new Date("2026-01-15T00:00:00.000Z"),
        startedAt: new Date("2026-01-10T00:00:00.000Z"),
      }),
      makeBook({
        finishedAt: new Date("2026-01-20T00:00:00.000Z"),
        startedAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeBook({ finishedAt: null, startedAt: null }),
    ]);

    expect(stats.startedAt).toBe("2026-01-05T00:00:00.000Z");
    expect(stats.lastFinishedAt).toBe("2026-01-20T00:00:00.000Z");
    expect(stats.readingDurationDays).toBe(15);
  });

  it("returns null dates and a null duration when no book carries reading dates", () => {
    const stats = computeSeriesStats([
      makeBook({ readingStatus: "not_started" }),
      makeBook({ readingStatus: "want_to_read" }),
    ]);

    expect(stats.startedAt).toBeNull();
    expect(stats.lastFinishedAt).toBeNull();
    expect(stats.readingDurationDays).toBeNull();
  });

  it("omits the duration when only a start date is present", () => {
    const stats = computeSeriesStats([
      makeBook({
        finishedAt: null,
        readingStatus: "reading",
        startedAt: new Date("2026-03-01T00:00:00.000Z"),
      }),
    ]);

    expect(stats.startedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(stats.lastFinishedAt).toBeNull();
    expect(stats.readingDurationDays).toBeNull();
  });

  it("omits the duration when the earliest start is later than the latest finish", () => {
    const stats = computeSeriesStats([
      makeBook({
        finishedAt: new Date("2026-01-05T00:00:00.000Z"),
        readingStatus: "finished",
        startedAt: null,
      }),
      makeBook({
        finishedAt: null,
        readingStatus: "reading",
        startedAt: new Date("2026-01-10T00:00:00.000Z"),
      }),
    ]);

    expect(stats.startedAt).toBe("2026-01-10T00:00:00.000Z");
    expect(stats.lastFinishedAt).toBe("2026-01-05T00:00:00.000Z");
    expect(stats.readingDurationDays).toBeNull();
  });
});

describe("computeSeriesStats full data", () => {
  it("computes every reading field for a fully populated series", () => {
    const stats = computeSeriesStats([
      makeBook({
        finishedAt: new Date("2026-01-10T00:00:00.000Z"),
        id: "b1",
        isFavorite: true,
        pagesCount: 300,
        partNumber: 1,
        rating: 8,
        readingStatus: "finished",
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        title: "One",
      }),
      makeBook({
        finishedAt: new Date("2026-01-20T00:00:00.000Z"),
        id: "b2",
        pagesCount: 200,
        partNumber: 2,
        rating: 9,
        readingStatus: "finished",
        startedAt: new Date("2026-01-05T00:00:00.000Z"),
        title: "Two",
      }),
      makeBook({
        id: "b3",
        pagesCount: 100,
        partNumber: 3,
        readingStatus: "reading",
        title: "Three",
      }),
    ]);

    expect(stats).toMatchObject({
      averagePages: 200,
      averageRating: 8.5,
      booksCount: 3,
      favoriteBook: { id: "b1", title: "One" },
      finishedCount: 2,
      lastFinishedAt: "2026-01-20T00:00:00.000Z",
      pagesCount: 600,
      readingCount: 1,
      readingDurationDays: 19,
      readPagesCount: 500,
      readPagesPartial: false,
      startedAt: "2026-01-01T00:00:00.000Z",
      unreadCount: 0,
    });
  });
});

describe("computeSeriesStats zero-valid guards", () => {
  it("keeps the counts numeric and the nullable fields null for an all-unread series", () => {
    const stats = computeSeriesStats([
      makeBook({ readingStatus: "not_started" }),
      makeBook({ readingStatus: "want_to_read" }),
    ]);

    expect(stats).toMatchObject({
      averagePages: null,
      averageRating: null,
      booksCount: 2,
      favoriteBook: null,
      finishedCount: 0,
      lastFinishedAt: null,
      pagesCount: null,
      readingCount: 0,
      readingDurationDays: null,
      readPagesCount: null,
      readPagesPartial: false,
      startedAt: null,
      unreadCount: 2,
    });
  });
});
