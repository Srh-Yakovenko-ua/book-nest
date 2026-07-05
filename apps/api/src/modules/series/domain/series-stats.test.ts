import type { SeriesBookView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { computeSeriesStats } from "./series-stats.js";

type StatsBook = Pick<SeriesBookView, "pagesCount" | "rating" | "readingStatus">;

function makeBook(overrides: Partial<StatsBook> = {}): StatsBook {
  return {
    pagesCount: null,
    rating: null,
    readingStatus: "not_started",
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
