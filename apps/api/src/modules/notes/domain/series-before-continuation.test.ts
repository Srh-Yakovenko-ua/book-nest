import type { Nullable, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  OverviewSeriesCandidate,
  RecapNoteRow,
  SeriesShapeBook,
} from "./series-before-continuation.js";

import {
  continuationReadingStatusOf,
  latestActivityOf,
  pickOverviewSeries,
  planBeforeContinuation,
  rankRecapNotes,
  SERIES_BEFORE_CONTINUATION_POLICY,
} from "./series-before-continuation.js";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function book({
  id,
  partNumber,
  readingStatus,
}: {
  id: string;
  partNumber: Nullable<number>;
  readingStatus: ReadingStatus;
}): SeriesShapeBook {
  return { createdAt: CREATED_AT, id, partNumber, readingStatus };
}

function candidate({
  hasBeforeContinuationPlan = true,
  lastActivityAt = null,
  readingStatus,
  seriesId,
}: {
  hasBeforeContinuationPlan?: boolean;
  lastActivityAt?: Nullable<Date>;
  readingStatus: ReadingStatus;
  seriesId: string;
}): OverviewSeriesCandidate {
  return {
    continuationReadingStatus: readingStatus,
    hasBeforeContinuationPlan,
    lastActivityAt,
    seriesId,
  };
}

function note({
  bookId,
  id,
  isFavorite = false,
  isPinned = false,
  updatedAt = CREATED_AT,
}: {
  bookId: string;
  id: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  updatedAt?: Date;
}): RecapNoteRow {
  return { bookId, id, isFavorite, isPinned, updatedAt };
}

const SAGA = [
  book({ id: "part-1", partNumber: 1, readingStatus: "finished" }),
  book({ id: "part-2", partNumber: 2, readingStatus: "dnf" }),
  book({ id: "part-3", partNumber: 3, readingStatus: "reading" }),
  book({ id: "part-4", partNumber: 4, readingStatus: "not_started" }),
];

describe("planBeforeContinuation", () => {
  it("SERIES-BC-01 is null without a continuation, a previous closed book or an eligible note", () => {
    const allClosed = SAGA.map((entry) => ({ ...entry, readingStatus: "finished" as const }));
    const firstOpen = [book({ id: "part-1", partNumber: 1, readingStatus: "paused" })];

    expect(planBeforeContinuation({ books: allClosed, notedBookIds: new Set(["part-1"]) })).toBe(
      null,
    );
    expect(planBeforeContinuation({ books: firstOpen, notedBookIds: new Set(["part-1"]) })).toBe(
      null,
    );
    expect(
      planBeforeContinuation({ books: SAGA, notedBookIds: new Set(["part-3", "part-4"]) }),
    ).toBeNull();
  });

  it("SERIES-BC-02 treats finished and dnf previous books as eligible sources", () => {
    const resolved = planBeforeContinuation({ books: SAGA, notedBookIds: new Set(["part-2"]) });

    expect(resolved?.continuationBookId).toBe("part-3");
    expect([...(resolved?.distanceByBookId.entries() ?? [])]).toEqual([
      ["part-1", 2],
      ["part-2", 1],
    ]);
  });

  it("SERIES-BC-03 leaves the continuation and later books out of the recap sources", () => {
    const resolved = planBeforeContinuation({
      books: SAGA,
      notedBookIds: new Set(["part-1", "part-3", "part-4"]),
    });

    expect(resolved?.distanceByBookId.has("part-3")).toBe(false);
    expect(resolved?.distanceByBookId.has("part-4")).toBe(false);
  });

  it("SERIES-BC-09 keeps the block for a reading, rereading or paused continuation", () => {
    for (const readingStatus of ["reading", "rereading", "paused"] as const) {
      const books = [
        book({ id: "part-1", partNumber: 1, readingStatus: "finished" }),
        book({ id: "part-2", partNumber: 2, readingStatus }),
      ];

      expect(
        planBeforeContinuation({ books, notedBookIds: new Set(["part-1"]) })
          ?.continuationReadingStatus,
      ).toBe(readingStatus);
    }
  });
});

describe("rankRecapNotes", () => {
  it("SERIES-BC-06 ranks pinned, favorite, distance, recency, then id", () => {
    const distanceByBookId = new Map([
      ["far", 2],
      ["near", 1],
    ]);
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-02-01T00:00:00.000Z");

    const ranked = rankRecapNotes({
      distanceByBookId,
      notes: [
        note({ bookId: "near", id: "near-b", updatedAt: older }),
        note({ bookId: "near", id: "near-a", updatedAt: older }),
        note({ bookId: "near", id: "near-newer", updatedAt: newer }),
        note({ bookId: "far", id: "far-plain", updatedAt: newer }),
        note({ bookId: "far", id: "far-favorite", isFavorite: true }),
        note({ bookId: "far", id: "far-pinned", isPinned: true }),
      ],
    });

    expect(ranked.map((entry) => entry.id)).toEqual([
      "far-pinned",
      "far-favorite",
      "near-newer",
      "near-a",
      "near-b",
      "far-plain",
    ]);
  });

  it("SERIES-BC-03 drops notes of books that are not previous closed books", () => {
    const ranked = rankRecapNotes({
      distanceByBookId: new Map([["previous", 1]]),
      notes: [note({ bookId: "continuation", id: "a" }), note({ bookId: "previous", id: "b" })],
    });

    expect(ranked.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("SERIES-BC-07 keeps a backend-owned preview limit of five", () => {
    expect(SERIES_BEFORE_CONTINUATION_POLICY.previewLimit).toBe(5);
  });
});

describe("continuationReadingStatusOf", () => {
  it("reads the first open book status and is null when every book is closed", () => {
    const allClosed = SAGA.map((entry) => ({ ...entry, readingStatus: "finished" as const }));

    expect(continuationReadingStatusOf(SAGA)).toBe("reading");
    expect(continuationReadingStatusOf(allClosed)).toBeNull();
    expect(continuationReadingStatusOf([])).toBeNull();
  });
});

describe("pickOverviewSeries", () => {
  it("puts a series with a before-continuation plan ahead of a memory-only one", () => {
    const recent = new Date("2026-03-01T00:00:00.000Z");

    const picked = pickOverviewSeries([
      candidate({
        hasBeforeContinuationPlan: false,
        lastActivityAt: recent,
        readingStatus: "reading",
        seriesId: "a",
      }),
      candidate({ readingStatus: "not_started", seriesId: "b" }),
    ]);

    expect(picked?.seriesId).toBe("b");
  });

  it("prefers a reading continuation, then a paused one, then any other", () => {
    const picked = pickOverviewSeries([
      candidate({ readingStatus: "not_started", seriesId: "a" }),
      candidate({ readingStatus: "paused", seriesId: "b" }),
      candidate({ readingStatus: "rereading", seriesId: "c" }),
    ]);

    expect(picked?.seriesId).toBe("c");
  });

  it("breaks a state tie by the latest activity, then by series id", () => {
    const recent = new Date("2026-03-01T00:00:00.000Z");
    const older = new Date("2026-01-01T00:00:00.000Z");

    expect(
      pickOverviewSeries([
        candidate({ lastActivityAt: older, readingStatus: "paused", seriesId: "a" }),
        candidate({ lastActivityAt: recent, readingStatus: "paused", seriesId: "b" }),
        candidate({ readingStatus: "paused", seriesId: "0" }),
      ])?.seriesId,
    ).toBe("b");
    expect(
      pickOverviewSeries([
        candidate({ readingStatus: "paused", seriesId: "b" }),
        candidate({ readingStatus: "paused", seriesId: "a" }),
      ])?.seriesId,
    ).toBe("a");
  });

  it("returns null without candidates", () => {
    expect(pickOverviewSeries([])).toBeNull();
  });
});

describe("latestActivityOf", () => {
  it("takes the latest known date and ignores missing ones", () => {
    const latest = new Date("2026-03-01T00:00:00.000Z");

    expect(latestActivityOf([null, CREATED_AT, latest])).toEqual(latest);
    expect(latestActivityOf([null])).toBeNull();
  });
});
