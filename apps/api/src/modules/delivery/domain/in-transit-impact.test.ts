import type { OwnershipStatus, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { ImpactSeriesBook, ImpactSeriesRow } from "./in-transit-impact.js";

import { buildInTransitImpact } from "./in-transit-impact.js";

const BASE_DATE = new Date("2026-01-01T00:00:00.000Z");

function book(overrides: Partial<ImpactSeriesBook> = {}): ImpactSeriesBook {
  return {
    createdAt: BASE_DATE,
    isArriving: false,
    ownershipStatus: "owned",
    partNumber: null,
    readingStatus: "not_started",
    ...overrides,
  };
}

function impactOf(seriesRows: ImpactSeriesRow[]) {
  return buildInTransitImpact({ goalRows: [], queueRows: [], seriesRows });
}

function part({
  isArriving = false,
  ownershipStatus = "owned",
  partNumber,
  readingStatus = "not_started",
}: {
  isArriving?: boolean;
  ownershipStatus?: OwnershipStatus;
  partNumber: number;
  readingStatus?: ReadingStatus;
}): ImpactSeriesBook {
  return book({ isArriving, ownershipStatus, partNumber, readingStatus });
}

function series(overrides: Partial<ImpactSeriesRow> = {}): ImpactSeriesRow {
  return { books: [], id: "series-1", totalBooks: null, ...overrides };
}

describe("buildInTransitImpact", () => {
  it("returns nothing when there is nothing to report", () => {
    expect(buildInTransitImpact({ goalRows: [], queueRows: [], seriesRows: [] })).toEqual([]);
  });

  describe("series_completed", () => {
    it("counts a series whose last missing copies are all arriving", () => {
      const rows = [
        series({
          books: [
            part({ partNumber: 1 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 3 }),
          ],
          totalBooks: 3,
        }),
      ];

      expect(impactOf(rows)).toContainEqual({
        booksCount: 2,
        kind: "series_completed",
        seriesCount: 1,
      });
    });

    it("skips a series that still misses a copy nobody is delivering", () => {
      const rows = [
        series({
          books: [
            part({ partNumber: 1 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
            part({ ownershipStatus: "want_to_buy", partNumber: 3 }),
          ],
          totalBooks: 3,
        }),
      ];

      expect(impactOf(rows)).not.toContainEqual(
        expect.objectContaining({ kind: "series_completed" }),
      );
    });

    it("skips a series whose declared volumes are not all in the library yet", () => {
      const rows = [
        series({
          books: [
            part({ partNumber: 1 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
          ],
          totalBooks: 5,
        }),
      ];

      expect(impactOf(rows)).not.toContainEqual(
        expect.objectContaining({ kind: "series_completed" }),
      );
    });

    it("skips a single-book series", () => {
      const rows = [
        series({
          books: [part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 1 })],
          totalBooks: 1,
        }),
      ];

      expect(impactOf(rows)).toEqual([]);
    });

    it("treats a lent-out copy as held", () => {
      const rows = [
        series({
          books: [
            part({ ownershipStatus: "lent_to_someone", partNumber: 1 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
          ],
        }),
      ];

      expect(impactOf(rows)).toContainEqual({
        booksCount: 1,
        kind: "series_completed",
        seriesCount: 1,
      });
    });
  });

  describe("series_ownership_gaps", () => {
    it("counts an arriving volume that sits between held volumes", () => {
      const rows = [
        series({
          books: [
            part({ partNumber: 1 }),
            part({ partNumber: 2 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 3 }),
            part({ partNumber: 4 }),
            part({ ownershipStatus: "want_to_buy", partNumber: 5 }),
          ],
        }),
      ];

      expect(impactOf(rows)).toContainEqual({
        booksCount: 1,
        kind: "series_ownership_gaps",
        seriesCount: 1,
      });
    });

    it("ignores an arriving volume that only extends the run", () => {
      const rows = [
        series({
          books: [
            part({ partNumber: 1 }),
            part({ partNumber: 2 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 3 }),
            part({ ownershipStatus: "want_to_buy", partNumber: 4 }),
          ],
        }),
      ];

      expect(impactOf(rows)).not.toContainEqual(
        expect.objectContaining({ kind: "series_ownership_gaps" }),
      );
    });

    it("does not report a series that is already counted as completed", () => {
      const rows = [
        series({
          books: [
            part({ partNumber: 1 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
            part({ partNumber: 3 }),
          ],
        }),
      ];

      const impact = impactOf(rows);

      expect(impact).toContainEqual({ booksCount: 1, kind: "series_completed", seriesCount: 1 });
      expect(impact).not.toContainEqual(expect.objectContaining({ kind: "series_ownership_gaps" }));
    });
  });

  describe("queue_available", () => {
    it("counts a queued arriving book with no unread earlier part", () => {
      const impact = buildInTransitImpact({
        goalRows: [],
        queueRows: [
          {
            id: "book-1",
            partNumber: 2,
            queuePriority: "high",
            seriesBooks: [{ partNumber: 1, readingStatus: "finished" }],
          },
          { id: "book-2", partNumber: null, queuePriority: null, seriesBooks: [] },
        ],
        seriesRows: [],
      });

      expect(impact).toContainEqual({
        booksCount: 2,
        highPriorityCount: 1,
        kind: "queue_available",
      });
    });

    it("skips a queued book still blocked by an unread earlier part", () => {
      const impact = buildInTransitImpact({
        goalRows: [],
        queueRows: [
          {
            id: "book-1",
            partNumber: 2,
            queuePriority: "high",
            seriesBooks: [{ partNumber: 1, readingStatus: "not_started" }],
          },
        ],
        seriesRows: [],
      });

      expect(impact).toEqual([]);
    });
  });

  describe("series_next_step", () => {
    it("counts a series whose next unread volume is arriving", () => {
      const rows = [
        series({
          books: [
            part({ partNumber: 1, readingStatus: "finished" }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
            part({ partNumber: 3 }),
          ],
        }),
      ];

      expect(impactOf(rows)).toContainEqual({ kind: "series_next_step", seriesCount: 1 });
    });

    it("skips a series whose next unread volume is already on the shelf", () => {
      const rows = [
        series({
          books: [
            part({ partNumber: 1 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
          ],
        }),
      ];

      expect(impactOf(rows)).not.toContainEqual(
        expect.objectContaining({ kind: "series_next_step" }),
      );
    });
  });

  describe("goal_books", () => {
    it("counts distinct books and goals", () => {
      const impact = buildInTransitImpact({
        goalRows: [
          { bookId: "book-1", goalId: "goal-1" },
          { bookId: "book-1", goalId: "goal-2" },
          { bookId: "book-2", goalId: "goal-1" },
        ],
        queueRows: [],
        seriesRows: [],
      });

      expect(impact).toContainEqual({ booksCount: 2, goalsCount: 2, kind: "goal_books" });
    });
  });

  it("orders insights by semantic value, not by count", () => {
    const impact = buildInTransitImpact({
      goalRows: [{ bookId: "book-9", goalId: "goal-1" }],
      queueRows: [{ id: "book-9", partNumber: null, queuePriority: null, seriesBooks: [] }],
      seriesRows: [
        series({
          books: [
            part({ partNumber: 1 }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
          ],
          id: "series-complete",
        }),
        series({
          books: [
            part({ partNumber: 1, readingStatus: "finished" }),
            part({ isArriving: true, ownershipStatus: "in_transit", partNumber: 2 }),
            part({ partNumber: 3 }),
            part({ ownershipStatus: "want_to_buy", partNumber: 4 }),
          ],
          id: "series-gap",
        }),
      ],
    });

    expect(impact.map((entry) => entry.kind)).toEqual([
      "series_completed",
      "series_ownership_gaps",
      "queue_available",
      "series_next_step",
      "goal_books",
    ]);
  });
});
