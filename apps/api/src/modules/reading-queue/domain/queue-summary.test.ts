import type { Nullable, OwnershipStatus, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  computeReadingQueueSummary,
  isAvailableOwnership,
  type ReadingQueueSummaryDomainRow,
} from "./queue-summary.js";

function seriesRow({
  ownershipStatus,
  partNumber,
  seriesBooks,
  seriesId,
}: {
  ownershipStatus: OwnershipStatus;
  partNumber: Nullable<number>;
  seriesBooks: Array<{ partNumber: Nullable<number>; readingStatus: ReadingStatus }>;
  seriesId: string;
}): ReadingQueueSummaryDomainRow {
  return { ownershipStatus, partNumber, seriesBooks, seriesId };
}

function standaloneRow(ownershipStatus: OwnershipStatus): ReadingQueueSummaryDomainRow {
  return { ownershipStatus, partNumber: null, seriesBooks: [], seriesId: null };
}

describe("isAvailableOwnership", () => {
  it("treats owned and borrowed_from_someone as available", () => {
    expect(isAvailableOwnership("owned")).toBe(true);
    expect(isAvailableOwnership("borrowed_from_someone")).toBe(true);
    expect(isAvailableOwnership("none")).toBe(false);
    expect(isAvailableOwnership("want_to_buy")).toBe(false);
    expect(isAvailableOwnership("in_transit")).toBe(false);
    expect(isAvailableOwnership("lent_to_someone")).toBe(false);
  });
});

describe("computeReadingQueueSummary", () => {
  it("returns all zeros for an empty queue", () => {
    expect(computeReadingQueueSummary([])).toEqual({
      availableNowCount: 0,
      blockedBySeriesOrderCount: 0,
      seriesBooksCount: 0,
      seriesInQueueCount: 0,
      standaloneBooksCount: 0,
      totalCount: 0,
      unavailableByOwnership: { inTransit: 0, lentToSomeone: 0, none: 0, wantToBuy: 0 },
      unavailableCount: 0,
    });
  });

  it("counts only standalone books when no row has a series", () => {
    const summary = computeReadingQueueSummary([standaloneRow("owned"), standaloneRow("owned")]);

    expect(summary.totalCount).toBe(2);
    expect(summary.standaloneBooksCount).toBe(2);
    expect(summary.seriesBooksCount).toBe(0);
    expect(summary.seriesInQueueCount).toBe(0);
    expect(summary.availableNowCount).toBe(2);
  });

  it("deduplicates the series count for two books of the same series", () => {
    const summary = computeReadingQueueSummary([
      seriesRow({ ownershipStatus: "owned", partNumber: null, seriesBooks: [], seriesId: "s-1" }),
      seriesRow({ ownershipStatus: "owned", partNumber: null, seriesBooks: [], seriesId: "s-1" }),
    ]);

    expect(summary.seriesInQueueCount).toBe(1);
    expect(summary.seriesBooksCount).toBe(2);
  });

  it("breaks down unavailable books by ownership status", () => {
    const summary = computeReadingQueueSummary([
      standaloneRow("none"),
      standaloneRow("want_to_buy"),
      standaloneRow("in_transit"),
      standaloneRow("lent_to_someone"),
      standaloneRow("owned"),
      standaloneRow("borrowed_from_someone"),
    ]);

    expect(summary.unavailableByOwnership).toEqual({
      inTransit: 1,
      lentToSomeone: 1,
      none: 1,
      wantToBuy: 1,
    });
    expect(summary.unavailableCount).toBe(4);
    expect(summary.availableNowCount).toBe(2);
    expect(summary.blockedBySeriesOrderCount).toBe(0);
  });

  it("counts an owned book with an unread earlier part as blocked, not available", () => {
    const summary = computeReadingQueueSummary([
      seriesRow({
        ownershipStatus: "owned",
        partNumber: 2,
        seriesBooks: [
          { partNumber: 1, readingStatus: "not_started" },
          { partNumber: 2, readingStatus: "not_started" },
        ],
        seriesId: "s-1",
      }),
    ]);

    expect(summary.blockedBySeriesOrderCount).toBe(1);
    expect(summary.availableNowCount).toBe(0);
  });

  it("counts an unavailable series book only as unavailable even with an unread earlier part", () => {
    const summary = computeReadingQueueSummary([
      seriesRow({
        ownershipStatus: "want_to_buy",
        partNumber: 2,
        seriesBooks: [{ partNumber: 1, readingStatus: "not_started" }],
        seriesId: "s-1",
      }),
    ]);

    expect(summary.unavailableCount).toBe(1);
    expect(summary.unavailableByOwnership.wantToBuy).toBe(1);
    expect(summary.blockedBySeriesOrderCount).toBe(0);
    expect(summary.availableNowCount).toBe(0);
  });

  it("partitions every row so the totals invariant holds on a mixed set", () => {
    const rows = [
      standaloneRow("owned"),
      standaloneRow("none"),
      standaloneRow("want_to_buy"),
      standaloneRow("in_transit"),
      standaloneRow("lent_to_someone"),
      standaloneRow("borrowed_from_someone"),
      seriesRow({
        ownershipStatus: "owned",
        partNumber: 2,
        seriesBooks: [
          { partNumber: 1, readingStatus: "not_started" },
          { partNumber: 2, readingStatus: "reading" },
        ],
        seriesId: "s-1",
      }),
      seriesRow({
        ownershipStatus: "owned",
        partNumber: 1,
        seriesBooks: [
          { partNumber: 1, readingStatus: "reading" },
          { partNumber: 2, readingStatus: "not_started" },
        ],
        seriesId: "s-2",
      }),
    ];

    const summary = computeReadingQueueSummary(rows);

    expect(summary.totalCount).toBe(rows.length);
    expect(
      summary.availableNowCount + summary.blockedBySeriesOrderCount + summary.unavailableCount,
    ).toBe(summary.totalCount);
    expect(summary.seriesBooksCount + summary.standaloneBooksCount).toBe(summary.totalCount);
    expect(summary.seriesInQueueCount).toBe(2);
  });
});
