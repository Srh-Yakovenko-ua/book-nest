import { describe, expect, it } from "vitest";

import type { SeriesWishlistAnchor, WishlistCountsBookRow } from "./wishlist-counts.js";

import { computeWishlistCounts, placeWishlistBookInSeries } from "./wishlist-counts.js";

const NOW = new Date("2026-08-10T12:00:00.000Z");

const EMPTY_COUNTS = {
  addedLast30Days: 0,
  missingFromSeries: { booksCount: 0, seriesCount: 0 },
  nextInSeries: { booksCount: 0, seriesCount: 0 },
  waitingOverSixMonths: 0,
};

function anchor(seriesId: string, highest: number): SeriesWishlistAnchor {
  return { highestPartNumberOutsideWishlist: highest, seriesId };
}

function book(overrides: Partial<WishlistCountsBookRow> = {}): WishlistCountsBookRow {
  return { partNumber: null, seriesId: null, wishlistAddedAt: null, ...overrides };
}

describe("computeWishlistCounts", () => {
  it("returns zeroes for an empty wishlist", () => {
    expect(computeWishlistCounts({ anchors: [], books: [], now: NOW })).toEqual(EMPTY_COUNTS);
  });

  it("counts a book added inside the last 30 days", () => {
    const counts = computeWishlistCounts({
      anchors: [],
      books: [book({ wishlistAddedAt: new Date("2026-07-25T12:00:00.000Z") })],
      now: NOW,
    });

    expect(counts.addedLast30Days).toBe(1);
    expect(counts.waitingOverSixMonths).toBe(0);
  });

  it("excludes a book added just outside the 30-day window", () => {
    const counts = computeWishlistCounts({
      anchors: [],
      books: [book({ wishlistAddedAt: new Date("2026-07-11T11:59:00.000Z") })],
      now: NOW,
    });

    expect(counts.addedLast30Days).toBe(0);
  });

  it("counts a book waiting longer than six months", () => {
    const counts = computeWishlistCounts({
      anchors: [],
      books: [book({ wishlistAddedAt: new Date("2026-02-09T12:00:00.000Z") })],
      now: NOW,
    });

    expect(counts.waitingOverSixMonths).toBe(1);
    expect(counts.addedLast30Days).toBe(0);
  });

  it("excludes a book that has waited just under six months", () => {
    const counts = computeWishlistCounts({
      anchors: [],
      books: [book({ wishlistAddedAt: new Date("2026-02-11T12:00:00.000Z") })],
      now: NOW,
    });

    expect(counts.waitingOverSixMonths).toBe(0);
  });

  it("ignores a book with no entry date in both time-based counts", () => {
    const counts = computeWishlistCounts({
      anchors: [],
      books: [book({ wishlistAddedAt: null })],
      now: NOW,
    });

    expect(counts.addedLast30Days).toBe(0);
    expect(counts.waitingOverSixMonths).toBe(0);
  });

  it("counts a part below the highest held part as a gap", () => {
    const counts = computeWishlistCounts({
      anchors: [anchor("s1", 5)],
      books: [book({ partNumber: 2, seriesId: "s1" })],
      now: NOW,
    });

    expect(counts.missingFromSeries).toEqual({ booksCount: 1, seriesCount: 1 });
    expect(counts.nextInSeries).toEqual({ booksCount: 0, seriesCount: 0 });
  });

  it("counts a part above the highest held part as a continuation", () => {
    const counts = computeWishlistCounts({
      anchors: [anchor("s1", 5)],
      books: [book({ partNumber: 6, seriesId: "s1" })],
      now: NOW,
    });

    expect(counts.nextInSeries).toEqual({ booksCount: 1, seriesCount: 1 });
    expect(counts.missingFromSeries).toEqual({ booksCount: 0, seriesCount: 0 });
  });

  it("never counts the same book in both series cards", () => {
    const counts = computeWishlistCounts({
      anchors: [anchor("s1", 5)],
      books: [
        book({ partNumber: 2, seriesId: "s1" }),
        book({ partNumber: 3, seriesId: "s1" }),
        book({ partNumber: 9, seriesId: "s1" }),
      ],
      now: NOW,
    });

    expect(counts.missingFromSeries).toEqual({ booksCount: 2, seriesCount: 1 });
    expect(counts.nextInSeries).toEqual({ booksCount: 1, seriesCount: 1 });
  });

  it("counts distinct series, not books, in the sub-lines", () => {
    const counts = computeWishlistCounts({
      anchors: [anchor("s1", 5), anchor("s2", 3)],
      books: [
        book({ partNumber: 1, seriesId: "s1" }),
        book({ partNumber: 2, seriesId: "s1" }),
        book({ partNumber: 1, seriesId: "s2" }),
      ],
      now: NOW,
    });

    expect(counts.missingFromSeries).toEqual({ booksCount: 3, seriesCount: 2 });
  });

  it("counts neither card for a series where every part is on the wishlist", () => {
    const counts = computeWishlistCounts({
      anchors: [],
      books: [book({ partNumber: 1, seriesId: "s1" }), book({ partNumber: 2, seriesId: "s1" })],
      now: NOW,
    });

    expect(counts.missingFromSeries).toEqual({ booksCount: 0, seriesCount: 0 });
    expect(counts.nextInSeries).toEqual({ booksCount: 0, seriesCount: 0 });
  });

  it("excludes a series book with no part number from both series cards", () => {
    const counts = computeWishlistCounts({
      anchors: [anchor("s1", 5)],
      books: [book({ partNumber: null, seriesId: "s1" })],
      now: NOW,
    });

    expect(counts.missingFromSeries).toEqual({ booksCount: 0, seriesCount: 0 });
    expect(counts.nextInSeries).toEqual({ booksCount: 0, seriesCount: 0 });
  });

  it("excludes a standalone book from both series cards", () => {
    const counts = computeWishlistCounts({
      anchors: [anchor("s1", 5)],
      books: [book({ partNumber: null, seriesId: null })],
      now: NOW,
    });

    expect(counts.missingFromSeries).toEqual({ booksCount: 0, seriesCount: 0 });
    expect(counts.nextInSeries).toEqual({ booksCount: 0, seriesCount: 0 });
  });
});

describe("placeWishlistBookInSeries", () => {
  const anchorBySeriesId = new Map([["s1", 5]]);

  it("uses the same gap and continuation boundary exposed to wishlist filters", () => {
    expect(
      placeWishlistBookInSeries({
        anchorBySeriesId,
        book: book({ partNumber: 4, seriesId: "s1" }),
      }),
    ).toEqual({ kind: "gap", seriesId: "s1" });
    expect(
      placeWishlistBookInSeries({
        anchorBySeriesId,
        book: book({ partNumber: 6, seriesId: "s1" }),
      }),
    ).toEqual({ kind: "continuation", seriesId: "s1" });
    expect(
      placeWishlistBookInSeries({
        anchorBySeriesId,
        book: book({ partNumber: 5, seriesId: "s1" }),
      }),
    ).toBeNull();
  });
});
