import { describe, expect, it } from "vitest";

import { genreCoverPreview, genreReadProgressPercent } from "./genre-card";

function covers(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `/cover-${index}.jpg`);
}

describe("genreCoverPreview", () => {
  it("shows up to four covers and counts the rest of the books as overflow", () => {
    expect(genreCoverPreview({ booksCount: 66, coverUrls: covers(4) })).toEqual({
      covers: covers(4),
      hiddenBooksCount: 62,
      kind: "covers",
    });
  });

  it("caps the preview at four even when more covers arrive", () => {
    expect(genreCoverPreview({ booksCount: 5, coverUrls: covers(6) })).toMatchObject({
      covers: covers(4),
      hiddenBooksCount: 1,
    });
  });

  it("counts books without a cover into the overflow", () => {
    expect(genreCoverPreview({ booksCount: 10, coverUrls: covers(3) })).toMatchObject({
      hiddenBooksCount: 7,
    });
  });

  it("has no overflow when every book is shown", () => {
    expect(genreCoverPreview({ booksCount: 2, coverUrls: covers(2) })).toMatchObject({
      hiddenBooksCount: 0,
    });
  });

  it("uses one placeholder slot when no book has a cover", () => {
    expect(genreCoverPreview({ booksCount: 1, coverUrls: [] })).toEqual({
      hiddenBooksCount: 0,
      kind: "placeholder",
    });
    expect(genreCoverPreview({ booksCount: 8, coverUrls: [] })).toEqual({
      hiddenBooksCount: 7,
      kind: "placeholder",
    });
  });
});

describe("genreReadProgressPercent", () => {
  it("rounds the share of finished books", () => {
    expect(genreReadProgressPercent({ booksCount: 43, readCount: 18 })).toBe(42);
    expect(genreReadProgressPercent({ booksCount: 3, readCount: 3 })).toBe(100);
    expect(genreReadProgressPercent({ booksCount: 12, readCount: 0 })).toBe(0);
  });

  it("is zero for a genre without books", () => {
    expect(genreReadProgressPercent({ booksCount: 0, readCount: 0 })).toBe(0);
  });
});
