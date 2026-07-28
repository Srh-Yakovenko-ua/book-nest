import type { MediaView } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  authorsDifferFromSeries,
  duplicatePartNumbers,
  nextAddablePartNumber,
  publisherDiffersFromSeries,
  resolveSeriesGenres,
  resolveSeriesReleaseYears,
  seriesCoverBooks,
} from "./series-details-derive";
import { makeSeriesBookView } from "./series.fixtures";

function makeCover(id: string): MediaView {
  return {
    contentType: "image/jpeg",
    createdAt: "2026-01-01T00:00:00.000Z",
    height: 800,
    id: `media-${id}`,
    kind: "book_cover",
    name: null,
    sizeBytes: 1024,
    urls: {
      card: `https://cdn.example/${id}-card.jpg`,
      full: `https://cdn.example/${id}-full.jpg`,
      thumb: `https://cdn.example/${id}-thumb.jpg`,
    },
    width: 600,
  };
}

describe("duplicatePartNumbers", () => {
  it("reports each repeated part number once, sorted ascending", () => {
    const duplicates = duplicatePartNumbers([
      makeSeriesBookView({ id: "a", partNumber: 3 }),
      makeSeriesBookView({ id: "b", partNumber: 1 }),
      makeSeriesBookView({ id: "c", partNumber: 3 }),
      makeSeriesBookView({ id: "d", partNumber: 1 }),
      makeSeriesBookView({ id: "e", partNumber: 1 }),
    ]);

    expect(duplicates).toEqual([1, 3]);
  });

  it("ignores unnumbered books and gaps", () => {
    expect(
      duplicatePartNumbers([
        makeSeriesBookView({ id: "a", partNumber: 1 }),
        makeSeriesBookView({ id: "b", partNumber: 3 }),
        makeSeriesBookView({ id: "c", partNumber: null }),
        makeSeriesBookView({ id: "d", partNumber: null }),
      ]),
    ).toEqual([]);
  });
});

describe("nextAddablePartNumber", () => {
  it("suggests the next number after the highest for an open series", () => {
    expect(
      nextAddablePartNumber({
        books: [
          makeSeriesBookView({ id: "a", partNumber: 1 }),
          makeSeriesBookView({ id: "b", partNumber: 4 }),
        ],
        totalBooks: null,
      }),
    ).toBe(5);
  });

  it("starts an empty series at one", () => {
    expect(nextAddablePartNumber({ books: [], totalBooks: null })).toBe(1);
  });

  it("fills the first gap inside a limited series", () => {
    expect(
      nextAddablePartNumber({
        books: [
          makeSeriesBookView({ id: "a", partNumber: 1 }),
          makeSeriesBookView({ id: "b", partNumber: 2 }),
          makeSeriesBookView({ id: "c", partNumber: 4 }),
        ],
        totalBooks: 5,
      }),
    ).toBe(3);
  });

  it("returns null when every slot of a limited series is filled", () => {
    expect(
      nextAddablePartNumber({
        books: [
          makeSeriesBookView({ id: "a", partNumber: 1 }),
          makeSeriesBookView({ id: "b", partNumber: 2 }),
          makeSeriesBookView({ id: "c", partNumber: 3 }),
        ],
        totalBooks: 3,
      }),
    ).toBe(null);
  });

  it("picks an inner free slot past duplicate and out-of-range numbers", () => {
    expect(
      nextAddablePartNumber({
        books: [
          makeSeriesBookView({ id: "a", partNumber: 1 }),
          makeSeriesBookView({ id: "b", partNumber: 2 }),
          makeSeriesBookView({ id: "c", partNumber: 2 }),
          makeSeriesBookView({ id: "d", partNumber: 5 }),
        ],
        totalBooks: 5,
      }),
    ).toBe(3);
  });
});

describe("authorsDifferFromSeries", () => {
  const seriesAuthors = [
    { id: "author-1", name: "Ребекка Яррос" },
    { id: "author-2", name: "Інший автор" },
  ];

  it("treats the same author set in a different order as equal", () => {
    expect(
      authorsDifferFromSeries({
        bookAuthors: [
          { id: "author-2", name: "Інший автор" },
          { id: "author-1", name: "Ребекка Яррос" },
        ],
        seriesAuthors,
      }),
    ).toBe(false);
  });

  it("compares by id rather than by name", () => {
    expect(
      authorsDifferFromSeries({
        bookAuthors: [
          { id: "author-1", name: "Rebecca Yarros" },
          { id: "author-2", name: "Other author" },
        ],
        seriesAuthors,
      }),
    ).toBe(false);
  });

  it("detects a subset, a superset and a disjoint set", () => {
    expect(
      authorsDifferFromSeries({
        bookAuthors: [{ id: "author-1", name: "Ребекка Яррос" }],
        seriesAuthors,
      }),
    ).toBe(true);
    expect(
      authorsDifferFromSeries({
        bookAuthors: [...seriesAuthors, { id: "author-3", name: "Третій" }],
        seriesAuthors,
      }),
    ).toBe(true);
    expect(
      authorsDifferFromSeries({
        bookAuthors: [{ id: "author-9", name: "Хтось" }],
        seriesAuthors,
      }),
    ).toBe(true);
  });

  it("treats two empty author sets as equal", () => {
    expect(authorsDifferFromSeries({ bookAuthors: [], seriesAuthors: [] })).toBe(false);
    expect(authorsDifferFromSeries({ bookAuthors: [], seriesAuthors })).toBe(true);
  });
});

describe("publisherDiffersFromSeries", () => {
  const publisher = { id: "publisher-1", name: "Vivat" };

  it("shows a book publisher only when the series spreads across several publishers", () => {
    expect(
      publisherDiffersFromSeries({
        bookPublisher: publisher,
        seriesPublishers: [publisher, { id: "publisher-2", name: "Ранок" }],
      }),
    ).toBe(true);
  });

  it("stays quiet when the series shares a single publisher", () => {
    expect(
      publisherDiffersFromSeries({ bookPublisher: publisher, seriesPublishers: [publisher] }),
    ).toBe(false);
  });

  it("stays quiet when the book carries no publisher", () => {
    expect(
      publisherDiffersFromSeries({
        bookPublisher: null,
        seriesPublishers: [publisher, { id: "publisher-2", name: "Ранок" }],
      }),
    ).toBe(false);
  });
});

describe("resolveSeriesGenres", () => {
  it("returns the declared series genres and ignores book genres", () => {
    expect(
      resolveSeriesGenres({
        books: [
          makeSeriesBookView({ genres: ["horror", "thriller"], id: "a" }),
          makeSeriesBookView({ genres: ["adventure"], id: "b" }),
        ],
        seriesGenres: ["fantasy", "romance"],
      }),
    ).toEqual(["fantasy", "romance"]);
  });

  it("falls back to the deduplicated union of book genres in first-seen order", () => {
    expect(
      resolveSeriesGenres({
        books: [
          makeSeriesBookView({ genres: ["fantasy", "romance"], id: "a" }),
          makeSeriesBookView({ genres: ["romance", "adventure"], id: "b" }),
          makeSeriesBookView({ genres: ["fantasy"], id: "c" }),
        ],
        seriesGenres: [],
      }),
    ).toEqual(["fantasy", "romance", "adventure"]);
  });

  it("returns an empty list when neither the series nor its books have genres", () => {
    expect(
      resolveSeriesGenres({
        books: [
          makeSeriesBookView({ genres: [], id: "a" }),
          makeSeriesBookView({ genres: [], id: "b" }),
        ],
        seriesGenres: [],
      }),
    ).toEqual([]);
  });
});

describe("resolveSeriesReleaseYears", () => {
  it("returns the first and last publication years of a completed series as a range", () => {
    expect(
      resolveSeriesReleaseYears({
        books: [
          makeSeriesBookView({ id: "c", partNumber: 3, publicationYear: 2024 }),
          makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 }),
          makeSeriesBookView({ id: "b", partNumber: 2, publicationYear: 2022 }),
        ],
        status: "completed",
      }),
    ).toEqual({ from: 2021, kind: "range", to: 2024 });
  });

  it("collapses a completed series into a single year when the ends share it", () => {
    expect(
      resolveSeriesReleaseYears({
        books: [
          makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2024 }),
          makeSeriesBookView({ id: "b", partNumber: 2, publicationYear: 2024 }),
        ],
        status: "completed",
      }),
    ).toEqual({ kind: "single", year: 2024 });
  });

  it("returns null when the last book of a completed series lacks a publication year", () => {
    expect(
      resolveSeriesReleaseYears({
        books: [
          makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 }),
          makeSeriesBookView({ id: "b", partNumber: 2, publicationYear: null }),
        ],
        status: "completed",
      }),
    ).toBe(null);
  });

  it("returns the first year as an open-ended range for an ongoing series", () => {
    expect(
      resolveSeriesReleaseYears({
        books: [
          makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 }),
          makeSeriesBookView({ id: "b", partNumber: 2, publicationYear: 2023 }),
        ],
        status: "ongoing",
      }),
    ).toEqual({ kind: "since", year: 2021 });
  });

  it("returns null when the first book of an ongoing series lacks a publication year", () => {
    expect(
      resolveSeriesReleaseYears({
        books: [makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: null })],
        status: "ongoing",
      }),
    ).toBe(null);
  });

  it("returns null for a series with an unknown status", () => {
    expect(
      resolveSeriesReleaseYears({
        books: [makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 })],
        status: "unknown",
      }),
    ).toBe(null);
  });

  it("ignores unnumbered books when picking the first and last by position", () => {
    expect(
      resolveSeriesReleaseYears({
        books: [
          makeSeriesBookView({ id: "loose", partNumber: null, publicationYear: 1999 }),
          makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 }),
          makeSeriesBookView({ id: "b", partNumber: 2, publicationYear: 2024 }),
        ],
        status: "completed",
      }),
    ).toEqual({ from: 2021, kind: "range", to: 2024 });
  });
});

describe("seriesCoverBooks", () => {
  it("orders by partNumber ascending and keeps unnumbered books last", () => {
    const covers = seriesCoverBooks([
      makeSeriesBookView({ cover: makeCover("c"), id: "extra-a", partNumber: null }),
      makeSeriesBookView({ cover: makeCover("b"), id: "third", partNumber: 3 }),
      makeSeriesBookView({ cover: makeCover("a"), id: "first", partNumber: 1 }),
      makeSeriesBookView({ cover: makeCover("d"), id: "extra-b", partNumber: null }),
    ]);

    expect(covers.map((cover) => cover.id)).toEqual(["first", "third", "extra-a", "extra-b"]);
  });

  it("keeps only books that have a cover url", () => {
    const covers = seriesCoverBooks([
      makeSeriesBookView({ cover: makeCover("a"), id: "with-cover", partNumber: 1 }),
      makeSeriesBookView({ cover: null, id: "null-cover", partNumber: 2 }),
      makeSeriesBookView({ id: "missing-cover", partNumber: 3 }),
    ]);

    expect(covers).toEqual([
      { id: "with-cover", src: "https://cdn.example/a-card.jpg", title: "Четверте крило" },
    ]);
  });

  it("returns an empty list when no book has a cover", () => {
    expect(seriesCoverBooks([makeSeriesBookView({ id: "no-cover" })])).toEqual([]);
  });

  it("does not mutate the source list", () => {
    const books = [
      makeSeriesBookView({ cover: makeCover("b"), id: "second", partNumber: 2 }),
      makeSeriesBookView({ cover: makeCover("a"), id: "first", partNumber: 1 }),
    ];

    seriesCoverBooks(books);

    expect(books.map((book) => book.id)).toEqual(["second", "first"]);
  });
});
