import { computeHasUnreadEarlierParts, OwnershipStatusSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { SeriesBookPreview, SeriesBookRow } from "./series-preview.js";

import { summarizeSeriesBooks, toSeriesBookPreview } from "./series-preview.js";

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

function makeRow(overrides: Partial<SeriesBookRow> = {}): SeriesBookRow {
  return { ...makeBook(), ...overrides };
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

    expect(summary.nextBook).toEqual({
      id: "part-1",
      ownershipStatus: "none",
      partNumber: 1,
      title: "First",
    });
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

  it("prefers a reading part over a not-started part with a lower part number", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, readingStatus: "not_started" }),
      makeBook({ id: "part-2", partNumber: 2, readingStatus: "reading" }),
    ]);

    expect(summary.nextBook?.id).toBe("part-2");
  });

  it("treats a rereading part the same as a reading part when picking next", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, readingStatus: "not_started" }),
      makeBook({ id: "part-2", partNumber: 2, readingStatus: "rereading" }),
    ]);

    expect(summary.nextBook?.id).toBe("part-2");
  });

  it("picks the lowest part number among multiple in-progress parts", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-3", partNumber: 3, readingStatus: "reading" }),
      makeBook({ id: "part-1", partNumber: 1, readingStatus: "reading" }),
      makeBook({ id: "part-2", partNumber: 2, readingStatus: "not_started" }),
    ]);

    expect(summary.nextBook?.id).toBe("part-1");
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

describe("toSeriesBookPreview ownershipStatus", () => {
  it("keeps every ownership status of the schema intact across the row boundary", () => {
    const statuses = OwnershipStatusSchema.options;

    const previews = statuses.map((ownershipStatus) =>
      toSeriesBookPreview(makeRow({ ownershipStatus })),
    );

    expect(previews.map((preview) => preview.ownershipStatus)).toEqual([...statuses]);
  });
});

describe("summarizeSeriesBooks nextBook ownershipStatus", () => {
  it("reports the ownership status of the in-progress part rather than the lowest part", () => {
    const summary = summarizeSeriesBooks([
      makeBook({
        id: "part-1",
        ownershipStatus: "owned",
        partNumber: 1,
        readingStatus: "not_started",
      }),
      makeBook({
        id: "part-2",
        ownershipStatus: "in_transit",
        partNumber: 2,
        readingStatus: "reading",
      }),
    ]);

    expect(summary.nextBook?.ownershipStatus).toBe("in_transit");
  });
});

describe("summarizeSeriesBooks missingPartNumbers", () => {
  it("returns an empty list for a series with no books", () => {
    expect(summarizeSeriesBooks([]).missingPartNumbers).toEqual([]);
  });

  it("reports every part below the single book of a series", () => {
    const summary = summarizeSeriesBooks([makeBook({ id: "part-4", partNumber: 4 })]);

    expect(summary.missingPartNumbers).toEqual([1, 2, 3]);
  });

  it("returns an empty list for a series whose single book is the first part", () => {
    const summary = summarizeSeriesBooks([makeBook({ id: "part-1", partNumber: 1 })]);

    expect(summary.missingPartNumbers).toEqual([]);
  });

  it("returns an empty list when every part between the first and the last is present", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1 }),
      makeBook({ id: "part-2", partNumber: 2 }),
      makeBook({ id: "part-3", partNumber: 3 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([]);
  });

  it("reports a single interior gap", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1 }),
      makeBook({ id: "part-3", partNumber: 3 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([2]);
  });

  it("reports every part of a multi-value gap in ascending order", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-5", partNumber: 5 }),
      makeBook({ id: "part-1", partNumber: 1 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([2, 3, 4]);
  });

  it("reports several separate gaps in ascending order regardless of input order", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-6", partNumber: 6 }),
      makeBook({ id: "part-2", partNumber: 2 }),
      makeBook({ id: "part-4", partNumber: 4 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([1, 3, 5]);
  });

  it("reports nothing when the only missing parts come after the highest present part", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1 }),
      makeBook({ id: "part-2", partNumber: 2 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([]);
  });

  it("reports the parts missing before the lowest present part", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-3", partNumber: 3 }),
      makeBook({ id: "part-4", partNumber: 4 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([1, 2]);
  });

  it("reports the two missing head parts of a contiguous third-to-fifth run", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-3", partNumber: 3 }),
      makeBook({ id: "part-4", partNumber: 4 }),
      makeBook({ id: "part-5", partNumber: 5 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([1, 2]);
  });

  it("reports the first part as missing when the series starts at the second part", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-2", partNumber: 2 }),
      makeBook({ id: "part-3", partNumber: 3 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([1]);
  });

  it("returns an empty list when every book has a null part number", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "companion-1", partNumber: null }),
      makeBook({ id: "companion-2", partNumber: null }),
    ]);

    expect(summary.missingPartNumbers).toEqual([]);
  });

  it("ignores books with a null part number when detecting a gap", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "companion", partNumber: null }),
      makeBook({ id: "part-1", partNumber: 1 }),
      makeBook({ id: "part-3", partNumber: 3 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([2]);
  });

  it("does not report a phantom gap when two books share the same part number", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1-hardcover", partNumber: 1 }),
      makeBook({ id: "part-1-ebook", partNumber: 1 }),
      makeBook({ id: "part-2", partNumber: 2 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([]);
  });

  it("reports each missing part once when duplicates surround a gap", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1-hardcover", partNumber: 1 }),
      makeBook({ id: "part-1-ebook", partNumber: 1 }),
      makeBook({ id: "part-3-hardcover", partNumber: 3 }),
      makeBook({ id: "part-3-ebook", partNumber: 3 }),
    ]);

    expect(summary.missingPartNumbers).toEqual([2]);
  });
});

describe("summarizeSeriesBooks hasPublisher", () => {
  it("is false when no book carries a publisher", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, publisherId: null }),
      makeBook({ id: "part-2", partNumber: 2, publisherId: null }),
    ]);

    expect(summary.hasPublisher).toBe(false);
  });

  it("is false for a series with no books", () => {
    expect(summarizeSeriesBooks([]).hasPublisher).toBe(false);
  });

  it("is true when only some books carry a publisher", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, publisherId: null }),
      makeBook({ id: "part-2", partNumber: 2, publisherId: "publisher-vivat" }),
    ]);

    expect(summary.hasPublisher).toBe(true);
  });

  it("is true when every book carries a publisher", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, publisherId: "publisher-vivat" }),
      makeBook({ id: "part-2", partNumber: 2, publisherId: "publisher-abab" }),
    ]);

    expect(summary.hasPublisher).toBe(true);
  });
});

describe("summarizeSeriesBooks hasPublicationYears", () => {
  it("is false when no book carries a publication year", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, publicationYear: null }),
      makeBook({ id: "part-2", partNumber: 2, publicationYear: null }),
    ]);

    expect(summary.hasPublicationYears).toBe(false);
  });

  it("is false for a series with no books", () => {
    expect(summarizeSeriesBooks([]).hasPublicationYears).toBe(false);
  });

  it("is true when only some books carry a publication year", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, publicationYear: null }),
      makeBook({ id: "part-2", partNumber: 2, publicationYear: 2018 }),
    ]);

    expect(summary.hasPublicationYears).toBe(true);
  });

  it("is true when every book carries a publication year", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, publicationYear: 2012 }),
      makeBook({ id: "part-2", partNumber: 2, publicationYear: 2018 }),
    ]);

    expect(summary.hasPublicationYears).toBe(true);
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

describe("summarizeSeriesBooks readingInSeries", () => {
  it("counts parts with a reading or rereading status", () => {
    const summary = summarizeSeriesBooks([
      makeBook({ id: "part-1", partNumber: 1, readingStatus: "reading" }),
      makeBook({ id: "part-2", partNumber: 2, readingStatus: "rereading" }),
      makeBook({ id: "part-3", partNumber: 3, readingStatus: "finished" }),
      makeBook({ id: "part-4", partNumber: 4, readingStatus: "not_started" }),
    ]);

    expect(summary.readingInSeries).toBe(2);
  });

  it("returns zero for an empty series", () => {
    expect(summarizeSeriesBooks([]).readingInSeries).toBe(0);
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
