import { describe, expect, it } from "vitest";

import { genresKeys, matchesGenreDerivedKey } from "./genres-keys";

const LIST_PARAMS = { filter: "all", sort: "books_count_desc" } as const;

const GENRE_KEYS = {
  catalog: genresKeys.catalog,
  facets: genresKeys.facets({ q: "фе" }),
  overview: genresKeys.overview,
  recent: genresKeys.recent,
  stats: genresKeys.stats(LIST_PARAMS),
  summary: genresKeys.summary,
} as const;

describe("matchesGenreDerivedKey", () => {
  it("matches the list, facets, summary and overview of the Genres page", () => {
    expect(matchesGenreDerivedKey({ queryKey: GENRE_KEYS.stats })).toBe(true);
    expect(matchesGenreDerivedKey({ queryKey: GENRE_KEYS.facets })).toBe(true);
    expect(matchesGenreDerivedKey({ queryKey: GENRE_KEYS.summary })).toBe(true);
    expect(matchesGenreDerivedKey({ queryKey: GENRE_KEYS.overview })).toBe(true);
  });

  it("leaves the global genre catalog and recent usage out", () => {
    expect(matchesGenreDerivedKey({ queryKey: GENRE_KEYS.catalog })).toBe(false);
    expect(matchesGenreDerivedKey({ queryKey: GENRE_KEYS.recent })).toBe(false);
  });
});

describe("genresKeys", () => {
  it("keeps the page number out of the list identity", () => {
    expect(genresKeys.stats(LIST_PARAMS)).toEqual(["/api/genres", "stats", LIST_PARAMS]);
  });
});
