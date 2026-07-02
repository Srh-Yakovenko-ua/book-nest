import { describe, expect, it } from "vitest";

import type { SeriesBookPreview } from "./series-preview.js";

import { computeHasUnreadEarlierParts, summarizeSeriesBooks } from "./series-preview.js";

function makeBook(overrides: Partial<SeriesBookPreview> = {}): SeriesBookPreview {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "book-default",
    partNumber: 1,
    readingStatus: "not_started",
    title: "Untitled",
    ...overrides,
  };
}

describe("summarizeSeriesBooks nextBook", () => {
  it("returns null for an empty series", () => {
    expect(summarizeSeriesBooks([]).nextBook).toBeNull();
  });

  it("picks the lowest part number regardless of input order", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-3", partNumber: 3, title: "Third" }),
      makeBook({ id: "part-1", partNumber: 1, title: "First" }),
      makeBook({ id: "part-2", partNumber: 2, title: "Second" }),
    ]);

    expect(summary.nextBook).toEqual({ id: "part-1", partNumber: 1, title: "First" });
  });

  it("sorts numbered parts before parts with a null part number", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-null", partNumber: null, title: "Companion" }),
      makeBook({ id: "part-5", partNumber: 5, title: "Fifth" }),
    ]);

    expect(summary.nextBook?.id).toBe("part-5");
  });

  it("breaks a part number tie by the earliest createdAt", () => {
    const summary = summarizeSeriesBooks([
      makeBook({
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        id: "later",
        partNumber: null,
      }),
      makeBook({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "earlier",
        partNumber: null,
      }),
    ]);

    expect(summary.nextBook?.id).toBe("earlier");
  });

  it("skips finished parts and returns the first unfinished one", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, readingStatus: "finished" }),
      makeBook({ id: "part-2", partNumber: 2, readingStatus: "reading" }),
    ]);

    expect(summary.nextBook?.id).toBe("part-2");
  });

  it("treats a dnf part as unfinished and eligible to be next", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, readingStatus: "dnf" }),
    ]);

    expect(summary.nextBook?.id).toBe("part-1");
  });

  it("returns null when every part is finished", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, readingStatus: "finished" }),
      makeBook({ id: "part-2", partNumber: 2, readingStatus: "finished" }),
    ]);

    expect(summary.nextBook).toBeNull();
  });
});

describe("summarizeSeriesBooks finishedInSeries", () => {
  it("counts only the parts with a finished reading status", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, readingStatus: "finished" }),
      makeBook({ id: "part-2", partNumber: 2, readingStatus: "reading" }),
      makeBook({ id: "part-3", partNumber: 3, readingStatus: "finished" }),
    ]);

    expect(summary.finishedInSeries).toBe(2);
  });

  it("returns zero for an empty series", () => {
    expect(summarizeSeriesBooks([]).finishedInSeries).toBe(0);
  });
});

describe("computeHasUnreadEarlierParts", () => {
  it("returns null when the current part number is null", () => {
    const result = computeHasUnreadEarlierParts({
      books: [makeBook({ partNumber: 1, readingStatus: "not_started" })],
      currentPartNumber: null,
    });

    expect(result).toBeNull();
  });

  it("returns true when an earlier part is not finished", () => {
    const result = computeHasUnreadEarlierParts({
      books: [
        makeBook({ id: "part-1", partNumber: 1, readingStatus: "reading" }),
        makeBook({ id: "part-2", partNumber: 2, readingStatus: "not_started" }),
      ],
      currentPartNumber: 2,
    });

    expect(result).toBe(true);
  });

  it("returns false when every earlier part is finished", () => {
    const result = computeHasUnreadEarlierParts({
      books: [
        makeBook({ id: "part-1", partNumber: 1, readingStatus: "finished" }),
        makeBook({ id: "part-2", partNumber: 2, readingStatus: "finished" }),
      ],
      currentPartNumber: 3,
    });

    expect(result).toBe(false);
  });

  it("ignores later unfinished parts", () => {
    const result = computeHasUnreadEarlierParts({
      books: [
        makeBook({ id: "part-1", partNumber: 1, readingStatus: "reading" }),
        makeBook({ id: "part-2", partNumber: 2, readingStatus: "not_started" }),
      ],
      currentPartNumber: 1,
    });

    expect(result).toBe(false);
  });

  it("ignores siblings with a null part number", () => {
    const result = computeHasUnreadEarlierParts({
      books: [
        makeBook({ id: "part-null", partNumber: null, readingStatus: "not_started" }),
        makeBook({ id: "part-1", partNumber: 1, readingStatus: "finished" }),
      ],
      currentPartNumber: 2,
    });

    expect(result).toBe(false);
  });
});
