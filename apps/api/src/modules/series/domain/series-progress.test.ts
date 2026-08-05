import { describe, expect, it } from "vitest";

import type { SeriesBookPreview } from "./series-preview.js";

import { computeSeriesProgress, isSeriesFullyRead, isSeriesUnfinished } from "./series-progress.js";

function makeBook(overrides: Partial<SeriesBookPreview> = {}): SeriesBookPreview {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "book-default",
    ownershipStatus: "none",
    partNumber: 1,
    publicationYear: null,
    publisherId: null,
    readingStatus: "not_started",
    title: "Untitled",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("computeSeriesProgress", () => {
  it("divides finished books by totalBooks when it is set", () => {
    const progress = computeSeriesProgress({
      books: [
        makeBook({ id: "a", readingStatus: "finished" }),
        makeBook({ id: "b", readingStatus: "finished" }),
        makeBook({ id: "c", readingStatus: "reading" }),
      ],
      totalBooks: 4,
    });

    expect(progress).toBe(0.5);
  });

  it("falls back to the loaded book count when totalBooks is null", () => {
    const progress = computeSeriesProgress({
      books: [
        makeBook({ id: "a", readingStatus: "finished" }),
        makeBook({ id: "b", readingStatus: "not_started" }),
      ],
      totalBooks: null,
    });

    expect(progress).toBe(0.5);
  });

  it("returns zero when there is no denominator", () => {
    expect(computeSeriesProgress({ books: [], totalBooks: null })).toBe(0);
  });
});

describe("isSeriesFullyRead", () => {
  it("returns false for an empty series", () => {
    expect(isSeriesFullyRead({ books: [], totalBooks: null })).toBe(false);
  });

  it("returns false when not every loaded book is finished", () => {
    const result = isSeriesFullyRead({
      books: [
        makeBook({ id: "a", readingStatus: "finished" }),
        makeBook({ id: "b", readingStatus: "reading" }),
      ],
      totalBooks: null,
    });

    expect(result).toBe(false);
  });

  it("returns true when every loaded book is finished and totalBooks is unknown", () => {
    const result = isSeriesFullyRead({
      books: [
        makeBook({ id: "a", readingStatus: "finished" }),
        makeBook({ id: "b", readingStatus: "finished" }),
      ],
      totalBooks: null,
    });

    expect(result).toBe(true);
  });

  it("returns false when finished books do not yet reach totalBooks", () => {
    const result = isSeriesFullyRead({
      books: [
        makeBook({ id: "a", readingStatus: "finished" }),
        makeBook({ id: "b", readingStatus: "finished" }),
      ],
      totalBooks: 3,
    });

    expect(result).toBe(false);
  });
});

describe("isSeriesUnfinished", () => {
  it("returns false for a single-book series", () => {
    const result = isSeriesUnfinished({
      books: [makeBook({ readingStatus: "reading" })],
      totalBooks: null,
    });

    expect(result).toBe(false);
  });

  it("returns false when no book has been engaged with", () => {
    const result = isSeriesUnfinished({
      books: [
        makeBook({ id: "a", readingStatus: "not_started" }),
        makeBook({ id: "b", readingStatus: "want_to_read" }),
      ],
      totalBooks: null,
    });

    expect(result).toBe(false);
  });

  it("returns true for a multi-book series that is engaged with but not fully read", () => {
    const result = isSeriesUnfinished({
      books: [
        makeBook({ id: "a", readingStatus: "finished" }),
        makeBook({ id: "b", readingStatus: "reading" }),
      ],
      totalBooks: null,
    });

    expect(result).toBe(true);
  });

  it("returns false once the series is fully read", () => {
    const result = isSeriesUnfinished({
      books: [
        makeBook({ id: "a", readingStatus: "finished" }),
        makeBook({ id: "b", readingStatus: "finished" }),
      ],
      totalBooks: 2,
    });

    expect(result).toBe(false);
  });

  it("treats totalBooks above one as multi-book even with a single loaded part", () => {
    const result = isSeriesUnfinished({
      books: [makeBook({ id: "a", readingStatus: "finished" })],
      totalBooks: 3,
    });

    expect(result).toBe(true);
  });
});
