import { describe, expect, it } from "vitest";

import type { HomeBookRecord } from "./home-book.mapper.js";

import { toHomeBookFacts } from "./home-book.mapper.js";

const BOOK_ID = "0b6f3c1e-2d4a-4b5c-9e8f-7a6b5c4d3e21";

function activeCycle(progressEvents: number): HomeBookRecord["readingCycles"][number] {
  return { _count: { events: progressEvents }, startedAt: new Date("2026-11-01T00:00:00.000Z") };
}

function bookRecord(overrides: Partial<HomeBookRecord> = {}): HomeBookRecord {
  return {
    _count: { readingCycles: 0 },
    authors: [],
    id: BOOK_ID,
    isFavorite: false,
    ownershipStatus: "owned",
    pagesCount: 400,
    partNumber: null,
    queuePosition: null,
    queuePriority: null,
    queuePriorityReason: null,
    queuePriorityTargetDate: null,
    readingCycles: [],
    readingProgress: null,
    readingStatus: "reading",
    series: null,
    title: "The Name of the Wind",
    ...overrides,
  };
}

describe("toHomeBookFacts", () => {
  it("shows the page and the rounded percent of an active cycle with progress", () => {
    const facts = toHomeBookFacts({
      book: bookRecord({
        readingCycles: [activeCycle(3)],
        readingProgress: { currentPage: 150 },
      }),
      cover: null,
    });

    expect(facts).toMatchObject({ currentPage: 150, progressPercent: 38 });
  });

  it("hides the page and percent left over from an ended cycle", () => {
    const facts = toHomeBookFacts({
      book: bookRecord({
        _count: { readingCycles: 1 },
        readingCycles: [activeCycle(0)],
        readingProgress: { currentPage: 400 },
        readingStatus: "rereading",
      }),
      cover: null,
    });

    expect(facts).toMatchObject({ currentPage: null, progressPercent: null });
  });

  it("keeps the page of a first read that has no progress events yet", () => {
    const facts = toHomeBookFacts({
      book: bookRecord({ readingProgress: { currentPage: 100 } }),
      cover: null,
    });

    expect(facts).toMatchObject({ currentPage: 100, progressPercent: 25 });
  });

  it("leaves the percent unknown when the page count is unknown", () => {
    const facts = toHomeBookFacts({
      book: bookRecord({
        pagesCount: null,
        readingCycles: [activeCycle(1)],
        readingProgress: { currentPage: 100 },
      }),
      cover: null,
    });

    expect(facts).toMatchObject({ currentPage: 100, progressPercent: null });
  });

  it("caps the percent at 100 when the page is past the page count", () => {
    const facts = toHomeBookFacts({
      book: bookRecord({
        readingCycles: [activeCycle(1)],
        readingProgress: { currentPage: 520 },
      }),
      cover: null,
    });

    expect(facts.progressPercent).toBe(100);
  });
});
