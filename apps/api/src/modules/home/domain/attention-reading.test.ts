import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { StaleReadingCandidate } from "./attention-reading.js";

import { buildReadingStaleAttention } from "./attention-reading.js";

const TODAY = "2026-11-24";

const BOOK_IDS = {
  first: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a61",
  second: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a62",
  third: "3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a63",
} as const;

function readingBook({
  id,
  lastProgressAt,
  title = "Piranesi",
}: {
  id: string;
  lastProgressAt: Nullable<string>;
  title?: string;
}): StaleReadingCandidate {
  return { id, lastProgressAt, title };
}

describe("buildReadingStaleAttention", () => {
  it("raises one low group for a book untouched for seven calendar days", () => {
    const groups = buildReadingStaleAttention({
      books: [readingBook({ id: BOOK_IDS.first, lastProgressAt: "2026-11-17" })],
      today: TODAY,
    });

    expect(groups).toEqual([
      expect.objectContaining({
        count: 1,
        reason: "reading_stale",
        severity: "low",
        unit: "books",
      }),
    ]);
  });

  it("names the book when it is the only stale one", () => {
    const groups = buildReadingStaleAttention({
      books: [
        readingBook({ id: BOOK_IDS.first, lastProgressAt: "2026-11-10", title: "Piranesi" }),
        readingBook({ id: BOOK_IDS.second, lastProgressAt: "2026-11-23", title: "Circe" }),
      ],
      today: TODAY,
    });

    expect(groups).toEqual([
      expect.objectContaining({ bookId: BOOK_IDS.first, bookTitle: "Piranesi", count: 1 }),
    ]);
  });

  it("raises nothing for a book last read six days ago", () => {
    expect(
      buildReadingStaleAttention({
        books: [readingBook({ id: BOOK_IDS.first, lastProgressAt: "2026-11-18" })],
        today: TODAY,
      }),
    ).toEqual([]);
  });

  it("raises nothing for a book without any recorded progress", () => {
    expect(
      buildReadingStaleAttention({
        books: [readingBook({ id: BOOK_IDS.first, lastProgressAt: null })],
        today: TODAY,
      }),
    ).toEqual([]);
  });

  it("groups several stale books into one anonymous group", () => {
    const groups = buildReadingStaleAttention({
      books: [
        readingBook({ id: BOOK_IDS.first, lastProgressAt: "2026-11-17" }),
        readingBook({ id: BOOK_IDS.second, lastProgressAt: "2026-10-02" }),
        readingBook({ id: BOOK_IDS.third, lastProgressAt: "2026-11-20" }),
      ],
      today: TODAY,
    });

    expect(groups).toEqual([
      expect.objectContaining({ bookId: null, bookTitle: null, count: 2, severity: "low" }),
    ]);
  });
});
