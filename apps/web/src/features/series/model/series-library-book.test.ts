import { describe, expect, it } from "vitest";

import type { SeriesLibraryBookLabels } from "./series-library-book";

import { seriesBookProgress, toSeriesLibraryBook } from "./series-library-book";
import { makeSeriesBookView } from "./series.fixtures";

const labels: SeriesLibraryBookLabels = {
  authorsUnknown: "Автор невідомий",
  ownershipLabel: (value) => `ownership:${value}`,
  ratingLabel: (value) => `rating:${value}`,
  statusLabel: (value) => `status:${value}`,
};

const seriesAuthors = [{ id: "author-1", name: "Ребекка Яррос" }];

function mapBook(book: Parameters<typeof toSeriesLibraryBook>[0]["book"]) {
  return toSeriesLibraryBook({ book, labels, seriesAuthors });
}

describe("toSeriesLibraryBook", () => {
  it("hides authors that match the series authors", () => {
    expect(mapBook(makeSeriesBookView()).authors).toEqual([]);
  });

  it("shows authors when the book has an author the series does not", () => {
    const book = makeSeriesBookView({
      authors: [
        { id: "author-1", name: "Ребекка Яррос" },
        { id: "author-2", name: "Інший автор" },
      ],
    });

    expect(mapBook(book).authors).toEqual(["Ребекка Яррос", "Інший автор"]);
  });

  it("falls back to the unknown-author label when the book has no authors of its own", () => {
    expect(mapBook(makeSeriesBookView({ authors: [] })).authors).toEqual(["Автор невідомий"]);
  });

  it("omits data the series payload does not carry", () => {
    const mapped = mapBook(makeSeriesBookView());

    expect(mapped.formats).toBeUndefined();
    expect(mapped.genres).toBeUndefined();
    expect(mapped.isInReadingQueue).toBeUndefined();
    expect(mapped.publisher).toBeUndefined();
    expect(mapped.series).toBeUndefined();
    expect(mapped.tags).toBeUndefined();
    expect(mapped.year).toBeUndefined();
  });

  it("keeps a real rating and drops null or zero ratings", () => {
    expect(mapBook(makeSeriesBookView({ rating: 9 })).rating).toBe(9);
    expect(mapBook(makeSeriesBookView({ rating: 9 })).ratingLabel).toBe("rating:9");
    expect(mapBook(makeSeriesBookView({ rating: null })).rating).toBeUndefined();
    expect(mapBook(makeSeriesBookView({ rating: 0 })).rating).toBeUndefined();
  });

  it("maps dnf to its own status badge", () => {
    const mapped = mapBook(makeSeriesBookView({ readingStatus: "dnf" }));

    expect(mapped.status.value).toBe("dnf");
    expect(mapped.status.label).toBe("status:dnf");
  });

  it("drops the ownership badge when nothing is known", () => {
    expect(mapBook(makeSeriesBookView({ ownershipStatus: "none" })).ownership).toBeUndefined();
    expect(mapBook(makeSeriesBookView({ ownershipStatus: "owned" })).ownership?.label).toBe(
      "ownership:owned",
    );
  });
});

describe("seriesBookProgress", () => {
  it("computes progress for a book being read", () => {
    const book = makeSeriesBookView({
      currentPage: 180,
      pagesCount: 640,
      readingStatus: "reading",
    });

    expect(seriesBookProgress(book)).toEqual({ current: 180, percent: 28, total: 640 });
  });

  it("computes progress while rereading", () => {
    const book = makeSeriesBookView({
      currentPage: 50,
      pagesCount: 100,
      readingStatus: "rereading",
    });

    expect(seriesBookProgress(book)?.percent).toBe(50);
  });

  it("returns nothing when the pages are unknown", () => {
    expect(
      seriesBookProgress(
        makeSeriesBookView({ currentPage: 10, pagesCount: null, readingStatus: "reading" }),
      ),
    ).toBeUndefined();
    expect(
      seriesBookProgress(
        makeSeriesBookView({ currentPage: null, pagesCount: 300, readingStatus: "reading" }),
      ),
    ).toBeUndefined();
    expect(
      seriesBookProgress(
        makeSeriesBookView({ currentPage: 10, pagesCount: 0, readingStatus: "reading" }),
      ),
    ).toBeUndefined();
  });

  it("returns nothing for statuses that are not being read now", () => {
    for (const readingStatus of ["finished", "dnf", "paused", "not_started"] as const) {
      expect(
        seriesBookProgress(makeSeriesBookView({ currentPage: 10, pagesCount: 100, readingStatus })),
      ).toBeUndefined();
    }
  });
});
