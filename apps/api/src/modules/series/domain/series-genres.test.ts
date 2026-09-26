import { describe, expect, it } from "vitest";

import type { SeriesGenreBookRow } from "./series-genres.js";

import { summarizeSeriesGenres } from "./series-genres.js";

function makeBook(genres: string[]): SeriesGenreBookRow {
  return { genres };
}

describe("summarizeSeriesGenres empty input", () => {
  it("returns no genres for a series with no books", () => {
    expect(summarizeSeriesGenres([])).toEqual([]);
  });

  it("returns no genres when the only book carries none", () => {
    expect(summarizeSeriesGenres([makeBook([])])).toEqual([]);
  });
});

describe("summarizeSeriesGenres majority rule", () => {
  it("keeps every genre of a single book", () => {
    expect(summarizeSeriesGenres([makeBook(["фентезі", "детектив"])])).toEqual([
      "детектив",
      "фентезі",
    ]);
  });

  it("keeps only the genre both books of a two-book series share", () => {
    const genres = summarizeSeriesGenres([
      makeBook(["фентезі", "детектив"]),
      makeBook(["фентезі", "романтика"]),
    ]);

    expect(genres).toEqual(["фентезі"]);
  });

  it("keeps a genre held by two of three books and drops one held by a single book", () => {
    const genres = summarizeSeriesGenres([
      makeBook(["фентезі", "детектив"]),
      makeBook(["фентезі"]),
      makeBook(["романтика"]),
    ]);

    expect(genres).toEqual(["фентезі"]);
  });

  it("drops a genre held by exactly half of an even-sized series", () => {
    const genres = summarizeSeriesGenres([
      makeBook(["фентезі"]),
      makeBook(["фентезі"]),
      makeBook(["детектив"]),
      makeBook(["детектив"]),
    ]);

    expect(genres).toEqual([]);
  });
});

describe("summarizeSeriesGenres ordering", () => {
  it("orders surviving genres by book count descending", () => {
    const genres = summarizeSeriesGenres([
      makeBook(["фентезі", "детектив"]),
      makeBook(["фентезі", "детектив"]),
      makeBook(["фентезі"]),
    ]);

    expect(genres).toEqual(["фентезі", "детектив"]);
  });

  it("breaks a book-count tie using Ukrainian collation order rather than byte order", () => {
    const genres = summarizeSeriesGenres([makeBook(["ялинка", "абетка", "Zombie"])]);

    expect(genres).toEqual(["абетка", "ялинка", "Zombie"]);
  });
});

describe("summarizeSeriesGenres cap", () => {
  it("keeps at most five genres even when more reach the majority", () => {
    const genres = summarizeSeriesGenres([
      makeBook(["a", "b", "c", "d", "e", "f", "g"]),
      makeBook(["a", "b", "c", "d", "e", "f", "g"]),
    ]);

    expect(genres).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("summarizeSeriesGenres duplicates within a book", () => {
  it("counts a repeated genre once per book", () => {
    const genres = summarizeSeriesGenres([
      makeBook(["фентезі", "фентезі", "фентезі"]),
      makeBook(["детектив"]),
      makeBook(["детектив"]),
    ]);

    expect(genres).toEqual(["детектив"]);
  });
});
