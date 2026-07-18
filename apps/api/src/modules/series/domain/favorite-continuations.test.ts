import type { Nullable, SeriesStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { ContinuationBook, ContinuationSeriesGroup } from "./favorite-continuations.js";

import { assembleContinuations } from "./favorite-continuations.js";

function makeBook(overrides: Partial<ContinuationBook> = {}): ContinuationBook {
  return {
    authors: [],
    cover: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    currentPage: null,
    favoriteAddedAt: null,
    id: "book-default",
    isFavorite: false,
    ownershipStatus: "none",
    pagesCount: null,
    partNumber: 1,
    queuePosition: null,
    queuePriority: null,
    readingStatus: "not_started",
    title: "Untitled",
    ...overrides,
  };
}

function makeGroup({
  books,
  id = "series-default",
  status = "ongoing",
  title = "Series",
  totalBooks = null,
}: {
  books: ContinuationBook[];
  id?: string;
  status?: SeriesStatus;
  title?: string;
  totalBooks?: Nullable<number>;
}): ContinuationSeriesGroup {
  return { books, series: { id, status, title, totalBooks } };
}

describe("assembleContinuations selection", () => {
  it("includes a series that has a favorite and at least two books", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "not_started" }),
        ],
        id: "series-1",
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.series.id).toBe("series-1");
    expect(result[0]?.nextBook.id).toBe("b2");
  });

  it("excludes a series without any favorite book", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "not_started" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result).toHaveLength(0);
  });

  it("excludes a single-book series even when its only book is favorite", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result).toHaveLength(0);
  });

  it("returns a single item with the favorite count when a series has multiple favorites", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
          makeBook({ id: "b3", partNumber: 3, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.favoriteBooksCount).toBe(2);
    expect(result[0]?.nextBook.id).toBe("b3");
    expect(result[0]?.nextBook.seriesPosition).toBe(3);
  });
});

describe("assembleContinuations next book", () => {
  it("selects the first not_started book by canonical order", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "not_started" }),
          makeBook({ id: "b2", isFavorite: true, partNumber: 2, readingStatus: "not_started" }),
          makeBook({ id: "b3", partNumber: 3, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("b1");
  });

  it("selects a want_to_read book as the next book", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "want_to_read" }),
          makeBook({ id: "b2", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("b1");
    expect(result[0]?.nextBook.readingStatus).toBe("want_to_read");
  });

  it("selects a reading book as the next book", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "reading" }),
          makeBook({ id: "b2", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("b1");
    expect(result[0]?.nextBook.readingStatus).toBe("reading");
  });

  it("selects a paused book as the next book", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "paused" }),
          makeBook({ id: "b2", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("b1");
    expect(result[0]?.nextBook.readingStatus).toBe("paused");
  });

  it("skips a finished book and returns the next actionable one", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("b2");
  });

  it("skips a dnf book when choosing the next book", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "dnf" }),
          makeBook({ id: "b3", partNumber: 3, readingStatus: "not_started" }),
          makeBook({ id: "b4", isFavorite: true, partNumber: 4, readingStatus: "finished" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("b3");
    expect(result[0]?.nextBook.seriesPosition).toBe(3);
  });

  it("prefers an earlier unread book over a later favorite book", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "not_started" }),
          makeBook({ id: "b3", isFavorite: true, partNumber: 3, readingStatus: "finished" }),
          makeBook({ id: "b4", partNumber: 4, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("b2");
    expect(result[0]?.nextBook.seriesPosition).toBe(2);
  });

  it("excludes a series when every book is closed", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "finished" }),
          makeBook({ id: "b3", partNumber: 3, readingStatus: "dnf" }),
        ],
      }),
    ]);

    expect(result).toHaveLength(0);
  });
});

describe("assembleContinuations ownership rank", () => {
  it("orders series by the documented rank priority", () => {
    const groups: ContinuationSeriesGroup[] = [
      makeGroup({
        books: [
          makeBook({ id: "none-next", ownershipStatus: "none", partNumber: 1 }),
          makeBook({ id: "none-fav", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
        id: "series-none",
      }),
      makeGroup({
        books: [
          makeBook({ id: "reading-next", partNumber: 1, readingStatus: "reading" }),
          makeBook({
            id: "reading-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-reading",
      }),
      makeGroup({
        books: [
          makeBook({ id: "transit-next", ownershipStatus: "in_transit", partNumber: 1 }),
          makeBook({
            id: "transit-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-transit",
      }),
      makeGroup({
        books: [
          makeBook({ id: "paused-next", partNumber: 1, readingStatus: "paused" }),
          makeBook({
            id: "paused-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-paused",
      }),
      makeGroup({
        books: [
          makeBook({ id: "want-next", ownershipStatus: "want_to_buy", partNumber: 1 }),
          makeBook({ id: "want-fav", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
        id: "series-want",
      }),
      makeGroup({
        books: [
          makeBook({ id: "avail-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({ id: "avail-fav", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
        id: "series-available",
      }),
      makeGroup({
        books: [
          makeBook({ id: "lent-next", ownershipStatus: "lent_to_someone", partNumber: 1 }),
          makeBook({ id: "lent-fav", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
        id: "series-lent",
      }),
    ];

    const result = assembleContinuations(groups);

    expect(result.map((item) => item.rankReason)).toEqual([
      "reading",
      "paused",
      "available",
      "lent",
      "in_transit",
      "want_to_buy",
      "not_owned",
    ]);
  });

  it("maps borrowed ownership to the available rank", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", ownershipStatus: "borrowed_from_someone", partNumber: 1 }),
          makeBook({ id: "b2", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
      }),
    ]);

    expect(result[0]?.rankReason).toBe("available");
  });

  it("maps a rereading next book to the reading rank", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "rereading" }),
          makeBook({ id: "b2", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
      }),
    ]);

    expect(result[0]?.rankReason).toBe("reading");
  });
});

describe("assembleContinuations tiebreakers", () => {
  it("ranks the series with the newer favorite date first within a rank", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "older-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({
            favoriteAddedAt: new Date("2026-01-01T00:00:00.000Z"),
            id: "older-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-a",
      }),
      makeGroup({
        books: [
          makeBook({ id: "newer-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({
            favoriteAddedAt: new Date("2026-02-01T00:00:00.000Z"),
            id: "newer-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-z",
      }),
    ]);

    expect(result.map((item) => item.series.id)).toEqual(["series-z", "series-a"]);
  });

  it("falls back to seriesId ascending when the favorite dates match", () => {
    const favoriteAddedAt = new Date("2026-01-01T00:00:00.000Z");
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({
            favoriteAddedAt,
            id: "b-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-b",
      }),
      makeGroup({
        books: [
          makeBook({ id: "a-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({
            favoriteAddedAt,
            id: "a-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-a",
      }),
    ]);

    expect(result.map((item) => item.series.id)).toEqual(["series-a", "series-b"]);
  });

  it("ranks a dated favorite above an undated one", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "undated-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({
            id: "undated-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-undated",
      }),
      makeGroup({
        books: [
          makeBook({ id: "dated-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({
            favoriteAddedAt: new Date("2026-01-01T00:00:00.000Z"),
            id: "dated-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-dated",
      }),
    ]);

    expect(result.map((item) => item.series.id)).toEqual(["series-dated", "series-undated"]);
  });

  it("produces the same order across repeated calls", () => {
    const groups: ContinuationSeriesGroup[] = [
      makeGroup({
        books: [
          makeBook({ id: "r-next", partNumber: 1, readingStatus: "reading" }),
          makeBook({ id: "r-fav", isFavorite: true, partNumber: 2, readingStatus: "finished" }),
        ],
        id: "series-reading",
      }),
      makeGroup({
        books: [
          makeBook({ id: "o1-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({
            favoriteAddedAt: new Date("2026-03-01T00:00:00.000Z"),
            id: "o1-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-owned-1",
      }),
      makeGroup({
        books: [
          makeBook({ id: "o2-next", ownershipStatus: "owned", partNumber: 1 }),
          makeBook({
            favoriteAddedAt: new Date("2026-01-01T00:00:00.000Z"),
            id: "o2-fav",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "finished",
          }),
        ],
        id: "series-owned-2",
      }),
    ];

    expect(assembleContinuations(groups)).toEqual(assembleContinuations(groups));
  });
});

describe("assembleContinuations series order", () => {
  it("orders integer positions ascending regardless of input order", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b3", partNumber: 3, readingStatus: "not_started" }),
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "not_started" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("b1");
    expect(result[0]?.nextBook.seriesPosition).toBe(1);
  });

  it("shows the existing book across a positional gap without inventing a missing one", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b3", partNumber: 3, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.seriesPosition).toBe(3);
  });

  it("breaks a duplicate position tie by the earliest createdAt", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({
            createdAt: new Date("2026-02-01T00:00:00.000Z"),
            id: "dup-late",
            partNumber: 2,
            readingStatus: "not_started",
          }),
          makeBook({
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            id: "dup-early",
            isFavorite: true,
            partNumber: 2,
            readingStatus: "not_started",
          }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("dup-early");
  });

  it("sorts numbered parts before a null part number", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "numbered", partNumber: 2, readingStatus: "not_started" }),
          makeBook({
            id: "unnumbered",
            isFavorite: true,
            partNumber: null,
            readingStatus: "not_started",
          }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("numbered");
    expect(result[0]?.nextBook.seriesPosition).toBe(2);
  });

  it("stays deterministic when the whole series lacks positions", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({
            createdAt: new Date("2026-02-01T00:00:00.000Z"),
            id: "null-late",
            partNumber: null,
            readingStatus: "not_started",
          }),
          makeBook({
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            id: "null-early",
            isFavorite: true,
            partNumber: null,
            readingStatus: "not_started",
          }),
        ],
      }),
    ]);

    expect(result[0]?.nextBook.id).toBe("null-early");
  });
});

describe("assembleContinuations progress and series view", () => {
  it("counts dnf as closed but not finished", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "dnf" }),
          makeBook({ id: "b3", isFavorite: true, partNumber: 3, readingStatus: "not_started" }),
        ],
      }),
    ]);

    expect(result[0]?.progress).toEqual({ closedBooks: 2, finishedBooks: 1, totalBooks: 3 });
  });

  it("uses the declared series total when present", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "not_started" }),
        ],
        totalBooks: 5,
      }),
    ]);

    expect(result[0]?.series.totalBooks).toBe(5);
  });

  it("falls back to the loaded book count when the series total is null", () => {
    const result = assembleContinuations([
      makeGroup({
        books: [
          makeBook({ id: "b1", isFavorite: true, partNumber: 1, readingStatus: "finished" }),
          makeBook({ id: "b2", partNumber: 2, readingStatus: "not_started" }),
        ],
        totalBooks: null,
      }),
    ]);

    expect(result[0]?.series.totalBooks).toBe(2);
  });
});
