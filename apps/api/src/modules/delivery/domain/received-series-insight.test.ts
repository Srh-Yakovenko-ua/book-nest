import type { Nullable, OwnershipStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { ReceivedSeriesRow } from "./received-series-insight.js";

import { buildReceivedSeriesInsights } from "./received-series-insight.js";

function book({
  isSubject = false,
  ownershipStatus = "owned",
  partNumber = null,
}: {
  isSubject?: boolean;
  ownershipStatus?: OwnershipStatus;
  partNumber?: Nullable<number>;
} = {}) {
  return { isSubject, ownershipStatus, partNumber };
}

function series({
  books,
  id = "series-1",
  totalBooks = null,
}: {
  books: ReceivedSeriesRow["books"];
  id?: string;
  totalBooks?: Nullable<number>;
}): ReceivedSeriesRow {
  return { books, id, totalBooks };
}

const completedSeries = series({
  books: [
    book({ partNumber: 1 }),
    book({ isSubject: true, partNumber: 2 }),
    book({ isSubject: true, partNumber: 3 }),
  ],
  totalBooks: 3,
});

const gapSeries = series({
  books: [
    book({ partNumber: 1 }),
    book({ partNumber: 2 }),
    book({ isSubject: true, partNumber: 3 }),
    book({ partNumber: 4 }),
  ],
  id: "series-2",
  totalBooks: 6,
});

const toppedUpSeries = series({
  books: [book({ partNumber: 1 }), book({ isSubject: true, partNumber: 2 })],
  id: "series-3",
  totalBooks: 5,
});

describe("buildReceivedSeriesInsights", () => {
  it("says nothing when no received book belongs to a series", () => {
    expect(buildReceivedSeriesInsights([])).toEqual([]);
  });

  it("stays silent when the received books only topped series up", () => {
    expect(buildReceivedSeriesInsights([toppedUpSeries])).toEqual([]);
  });

  it("counts the series the received books completed", () => {
    expect(buildReceivedSeriesInsights([completedSeries])).toEqual([
      { booksCount: 2, kind: "series_completed", seriesCount: 1 },
    ]);
  });

  it("counts the ownership gaps a received part closed", () => {
    expect(buildReceivedSeriesInsights([gapSeries])).toEqual([
      { booksCount: 1, kind: "series_gaps_closed", seriesCount: 1 },
    ]);
  });

  it("leaves a part outside the held range out of the gap count", () => {
    const trailing = series({
      books: [book({ partNumber: 1 }), book({ isSubject: true, partNumber: 2 })],
      totalBooks: 5,
    });

    expect(buildReceivedSeriesInsights([trailing])).toEqual([]);
  });

  it("ranks the insights and counts each series only under its strongest one", () => {
    expect(buildReceivedSeriesInsights([toppedUpSeries, gapSeries, completedSeries])).toEqual([
      { booksCount: 2, kind: "series_completed", seriesCount: 1 },
      { booksCount: 1, kind: "series_gaps_closed", seriesCount: 1 },
      { booksCount: 1, kind: "series_topped_up", seriesCount: 1 },
    ]);
  });

  it("does not call a series complete while a book of it is still unowned", () => {
    const stillMissing = series({
      books: [
        book({ isSubject: true, partNumber: 1 }),
        book({ ownershipStatus: "want_to_buy", partNumber: 2 }),
      ],
      totalBooks: 2,
    });

    expect(buildReceivedSeriesInsights([stillMissing])).toEqual([]);
  });

  it("does not call a series complete while the planned total is not on the shelf", () => {
    const shortOfPlan = series({
      books: [book({ isSubject: true, partNumber: 1 }), book({ partNumber: 2 })],
      totalBooks: 4,
    });

    expect(buildReceivedSeriesInsights([shortOfPlan])).toEqual([]);
  });

  it("counts a lent-out copy as held, both for completeness and for the gap bounds", () => {
    const lentOut = series({
      books: [
        book({ ownershipStatus: "lent_to_someone", partNumber: 1 }),
        book({ isSubject: true, partNumber: 2 }),
        book({ ownershipStatus: "lent_to_someone", partNumber: 3 }),
      ],
      totalBooks: 4,
    });

    expect(buildReceivedSeriesInsights([lentOut])).toEqual([
      { booksCount: 1, kind: "series_gaps_closed", seriesCount: 1 },
    ]);
  });

  it("keeps a one-book series out of the completed count", () => {
    const single = series({
      books: [book({ isSubject: true, partNumber: 1 })],
      totalBooks: 1,
    });

    expect(buildReceivedSeriesInsights([single])).toEqual([]);
  });
});
