import type { HomeActiveBook, HomeActiveBooksPage, Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  activeBookProgress,
  activeBookUpdate,
  clampCarouselIndex,
  homeCarouselWindow,
  mergeActiveBookPages,
} from "./home-active-books";

const BOOK_IDS = {
  first: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01",
  second: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02",
  third: "3c4d5e6f-7a8b-4c9d-ae1f-2a3b4c5d6e03",
} as const;

function activeBook(overrides: Partial<HomeActiveBook> = {}): HomeActiveBook {
  return {
    authors: [{ id: "4d5e6f7a-8b9c-4d0e-bf2a-3b4c5d6e7f04", name: "Урсула Ле Ґуїн" }],
    cover: null,
    currentPage: null,
    cycleStartedAt: "2026-11-01",
    id: BOOK_IDS.first,
    lastProgressAt: null,
    pagesCount: null,
    progressPercent: null,
    readingStatus: "reading",
    series: null,
    title: "Чарівник Земномор'я",
    ...overrides,
  };
}

function page(items: HomeActiveBook[], nextCursor: Nullable<string> = null): HomeActiveBooksPage {
  return { items, nextCursor, total: 3 };
}

describe("mergeActiveBookPages", () => {
  it("keeps the books of every page in order", () => {
    const merged = mergeActiveBookPages([
      page([activeBook({ id: BOOK_IDS.first })], "cursor-1"),
      page([activeBook({ id: BOOK_IDS.second }), activeBook({ id: BOOK_IDS.third })]),
    ]);

    expect(merged.map(({ id }) => id)).toEqual([BOOK_IDS.first, BOOK_IDS.second, BOOK_IDS.third]);
  });

  it("shows a book that moved onto the next page only once", () => {
    const merged = mergeActiveBookPages([
      page([activeBook({ id: BOOK_IDS.first }), activeBook({ id: BOOK_IDS.second })], "cursor-1"),
      page([activeBook({ id: BOOK_IDS.second }), activeBook({ id: BOOK_IDS.third })]),
    ]);

    expect(merged.map(({ id }) => id)).toEqual([BOOK_IDS.first, BOOK_IDS.second, BOOK_IDS.third]);
  });
});

describe("activeBookProgress", () => {
  it("shows the page, the total and the percent when all are known", () => {
    expect(
      activeBookProgress(activeBook({ currentPage: 120, pagesCount: 400, progressPercent: 30 })),
    ).toEqual({ currentPage: 120, kind: "page", pagesCount: 400, percent: 30 });
  });

  it("shows the page without inventing a total or a percent", () => {
    expect(activeBookProgress(activeBook({ currentPage: 120 }))).toEqual({
      currentPage: 120,
      kind: "page",
      pagesCount: null,
      percent: null,
    });
  });

  it("shows only the percent when the page is unknown", () => {
    expect(activeBookProgress(activeBook({ progressPercent: 45 }))).toEqual({
      kind: "percent",
      percent: 45,
    });
  });

  it("shows no progress rather than zero when nothing is known", () => {
    expect(activeBookProgress(activeBook())).toEqual({ kind: "unknown" });
  });

  it("keeps a real first page as progress", () => {
    expect(activeBookProgress(activeBook({ currentPage: 0, pagesCount: 300 }))).toMatchObject({
      currentPage: 0,
      kind: "page",
    });
  });
});

describe("activeBookUpdate", () => {
  it("marks a book updated exactly seven calendar days ago as stale", () => {
    expect(activeBookUpdate({ lastProgressAt: "2026-11-17", today: "2026-11-24" })).toEqual({
      daysAgo: 7,
      isStale: true,
      kind: "known",
    });
  });

  it("keeps a book updated six calendar days ago fresh", () => {
    expect(activeBookUpdate({ lastProgressAt: "2026-11-18", today: "2026-11-24" })).toEqual({
      daysAgo: 6,
      isStale: false,
      kind: "known",
    });
  });

  it("counts calendar days across a month end", () => {
    expect(activeBookUpdate({ lastProgressAt: "2026-11-26", today: "2026-12-03" })).toEqual({
      daysAgo: 7,
      isStale: true,
      kind: "known",
    });
  });

  it("counts calendar days across the autumn clock change", () => {
    expect(activeBookUpdate({ lastProgressAt: "2026-10-22", today: "2026-10-28" })).toEqual({
      daysAgo: 6,
      isStale: false,
      kind: "known",
    });
  });

  it("does not call a book stale when its last update is unknown", () => {
    expect(activeBookUpdate({ lastProgressAt: null, today: "2026-11-24" })).toEqual({
      kind: "unknown",
    });
  });
});

describe("homeCarouselWindow", () => {
  it("cannot go back from the first card", () => {
    expect(homeCarouselWindow({ count: 6, hasMore: false, visible: [0, 1] })).toEqual({
      canGoNext: true,
      canGoPrevious: false,
      first: 0,
      last: 1,
      shouldLoadMore: false,
    });
  });

  it("cannot go forward from the last card when there is nothing more to load", () => {
    expect(homeCarouselWindow({ count: 6, hasMore: false, visible: [4, 5] })).toEqual({
      canGoNext: false,
      canGoPrevious: true,
      first: 4,
      last: 5,
      shouldLoadMore: false,
    });
  });

  it("can go forward from the last loaded card when more books can be loaded", () => {
    expect(homeCarouselWindow({ count: 6, hasMore: true, visible: [4, 5] })).toMatchObject({
      canGoNext: true,
      shouldLoadMore: true,
    });
  });

  it("asks for more books when the second-to-last card comes into view", () => {
    expect(homeCarouselWindow({ count: 6, hasMore: true, visible: [3, 4] }).shouldLoadMore).toBe(
      true,
    );
  });

  it("does not ask for more books while the end is still far away", () => {
    expect(homeCarouselWindow({ count: 6, hasMore: true, visible: [0, 1] }).shouldLoadMore).toBe(
      false,
    );
  });

  it("ignores visible indexes left over from a removed card", () => {
    expect(homeCarouselWindow({ count: 5, hasMore: false, visible: [4, 5] })).toMatchObject({
      canGoNext: false,
      first: 4,
      last: 4,
    });
  });
});

describe("clampCarouselIndex", () => {
  it("moves to the new last card when the last one was removed", () => {
    expect(clampCarouselIndex({ count: 5, index: 5 })).toBe(4);
  });

  it("keeps an index that is still in range", () => {
    expect(clampCarouselIndex({ count: 5, index: 2 })).toBe(2);
  });

  it("does not go below the first card", () => {
    expect(clampCarouselIndex({ count: 5, index: -1 })).toBe(0);
  });

  it("returns the first position when no card is left", () => {
    expect(clampCarouselIndex({ count: 0, index: 3 })).toBe(0);
  });
});
