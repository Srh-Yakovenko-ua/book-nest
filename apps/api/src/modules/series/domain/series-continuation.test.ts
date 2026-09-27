import type { Nullable, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  resolveContinuationReason,
  resolveSeriesContinuation,
  toContinuationProgress,
} from "./series-continuation.js";

type Book = {
  createdAt: Date;
  id: string;
  partNumber: Nullable<number>;
  readingStatus: ReadingStatus;
};

const DEFAULT_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

function book({
  createdAt = DEFAULT_CREATED_AT,
  id,
  partNumber,
  readingStatus,
}: {
  createdAt?: Date;
  id: string;
  partNumber: Nullable<number>;
  readingStatus: ReadingStatus;
}): Book {
  return { createdAt, id, partNumber, readingStatus };
}

function idsOf(books: Book[]): string[] {
  return books.map((entry) => entry.id);
}

describe("resolveSeriesContinuation", () => {
  it("SERIES-BC-08 picks the first non-closed book in canonical part order", () => {
    const resolved = resolveSeriesContinuation([
      book({ id: "third", partNumber: 3, readingStatus: "not_started" }),
      book({ id: "first", partNumber: 1, readingStatus: "finished" }),
      book({ id: "second", partNumber: 2, readingStatus: "dnf" }),
    ]);

    expect(resolved?.continuation.id).toBe("third");
    expect(resolved?.continuationIndex).toBe(2);
    expect(idsOf(resolved?.previousClosed ?? [])).toEqual(["first", "second"]);
  });

  it("orders books without a part after numbered ones, then by creation", () => {
    const resolved = resolveSeriesContinuation([
      book({
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        id: "late-unnumbered",
        partNumber: null,
        readingStatus: "not_started",
      }),
      book({
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        id: "early-unnumbered",
        partNumber: null,
        readingStatus: "finished",
      }),
      book({ id: "numbered", partNumber: 1, readingStatus: "finished" }),
    ]);

    expect(resolved?.continuation.id).toBe("late-unnumbered");
    expect(idsOf(resolved?.previousClosed ?? [])).toEqual(["numbered", "early-unnumbered"]);
  });

  it("stops at the first open book even when a later one is in progress", () => {
    const resolved = resolveSeriesContinuation([
      book({ id: "first", partNumber: 1, readingStatus: "not_started" }),
      book({ id: "second", partNumber: 2, readingStatus: "reading" }),
    ]);

    expect(resolved?.continuation.id).toBe("first");
    expect(resolved?.previousClosed).toEqual([]);
  });

  it("returns null when every known book is closed", () => {
    expect(
      resolveSeriesContinuation([
        book({ id: "first", partNumber: 1, readingStatus: "finished" }),
        book({ id: "second", partNumber: 2, readingStatus: "dnf" }),
      ]),
    ).toBeNull();
  });
});

describe("resolveContinuationReason", () => {
  it("prefers the reading state and falls back to ownership", () => {
    expect(resolveContinuationReason({ ownershipStatus: "none", readingStatus: "rereading" })).toBe(
      "reading",
    );
    expect(resolveContinuationReason({ ownershipStatus: "owned", readingStatus: "paused" })).toBe(
      "paused",
    );
    expect(
      resolveContinuationReason({ ownershipStatus: "want_to_buy", readingStatus: "not_started" }),
    ).toBe("want_to_buy");
  });
});

describe("toContinuationProgress", () => {
  it("caps the percentage and leaves it null without a page count", () => {
    expect(toContinuationProgress({ currentPage: 150, pagesCount: 100 })).toEqual({
      currentPage: 150,
      percentage: 100,
      totalPages: 100,
    });
    expect(toContinuationProgress({ currentPage: 10, pagesCount: null })).toEqual({
      currentPage: 10,
      percentage: null,
      totalPages: null,
    });
    expect(toContinuationProgress({ currentPage: null, pagesCount: 100 })).toBeNull();
  });
});
