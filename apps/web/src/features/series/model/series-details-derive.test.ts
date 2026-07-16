import type { MediaView } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  authorsDifferFromSeries,
  duplicatePartNumbers,
  seriesBooksInReadingOrder,
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

describe("seriesBooksInReadingOrder", () => {
  it("sorts by part number ascending and keeps unnumbered books last", () => {
    const ordered = seriesBooksInReadingOrder([
      makeSeriesBookView({ id: "extra-a", partNumber: null }),
      makeSeriesBookView({ id: "fourth", partNumber: 4 }),
      makeSeriesBookView({ id: "first", partNumber: 1 }),
      makeSeriesBookView({ id: "extra-b", partNumber: null }),
      makeSeriesBookView({ id: "third", partNumber: 3 }),
    ]);

    expect(ordered.map((book) => book.id)).toEqual([
      "first",
      "third",
      "fourth",
      "extra-a",
      "extra-b",
    ]);
  });

  it("keeps duplicate part numbers in their original order", () => {
    const ordered = seriesBooksInReadingOrder([
      makeSeriesBookView({ id: "second-of-two", partNumber: 2 }),
      makeSeriesBookView({ id: "first-of-two", partNumber: 2 }),
      makeSeriesBookView({ id: "first", partNumber: 1 }),
    ]);

    expect(ordered.map((book) => book.id)).toEqual(["first", "second-of-two", "first-of-two"]);
  });

  it("does not mutate the source list", () => {
    const books = [
      makeSeriesBookView({ id: "second", partNumber: 2 }),
      makeSeriesBookView({ id: "first", partNumber: 1 }),
    ];

    seriesBooksInReadingOrder(books);

    expect(books.map((book) => book.id)).toEqual(["second", "first"]);
  });
});

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
