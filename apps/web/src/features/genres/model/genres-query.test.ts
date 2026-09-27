import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { GenresQueryState } from "./genres-query";

import {
  activeAdvancedFilterCount,
  committedGenresSearch,
  GENRES_QUERY,
  GENRES_QUERY_PARSERS,
  hasActiveGenresFilters,
  normalizeAdvancedFilters,
  resetGenresFiltersPatch,
  toGenresAdvancedPatch,
  toGenresDatasetParams,
  toGenresListParams,
} from "./genres-query";

const loadGenresQuery = createLoader(GENRES_QUERY_PARSERS);

function stateFrom(search: string): GenresQueryState {
  return loadGenresQuery(new URLSearchParams(search));
}

describe("genres URL state", () => {
  it("falls back to the defaults for an empty URL", () => {
    expect(stateFrom("")).toEqual({
      booksMax: null,
      booksMin: null,
      filter: "all",
      group: [],
      q: "",
      ratingMax: null,
      ratingMin: null,
      sort: "books_count_desc",
    });
  });

  it("reads every list-identity parameter from the URL", () => {
    const state = stateFrom(
      "q=фент&filter=unread&group=fiction,nonfiction&booksMin=2&booksMax=10&ratingMin=6.5&ratingMax=9&sort=rating_desc",
    );

    expect(state).toEqual({
      booksMax: 10,
      booksMin: 2,
      filter: "unread",
      group: ["fiction", "nonfiction"],
      q: "фент",
      ratingMax: 9,
      ratingMin: 6.5,
      sort: "rating_desc",
    });
  });

  it.each(["", "1e2", " 5", "5 ", "0x10", "+3", "4.0"])(
    "treats a non-digit books bound %j as absent",
    (raw) => {
      const state = stateFrom(new URLSearchParams({ booksMax: raw, booksMin: raw }).toString());

      expect(state.booksMin).toBeNull();
      expect(state.booksMax).toBeNull();
    },
  );

  it("accepts a plain digit books bound, including zero", () => {
    const state = stateFrom("booksMin=0&booksMax=007");

    expect(state.booksMin).toBe(0);
    expect(state.booksMax).toBe(7);
  });

  it("drops values the contract rejects instead of forwarding them", () => {
    const state = stateFrom(
      "filter=popular&sort=newest&booksMin=-1&booksMax=2.5&ratingMin=0&ratingMax=9.3&view=list",
    );

    expect(state.filter).toBe("all");
    expect(state.sort).toBe("books_count_desc");
    expect(state.booksMin).toBeNull();
    expect(state.booksMax).toBeNull();
    expect(state.ratingMin).toBeNull();
    expect(state.ratingMax).toBeNull();
    expect(state).not.toHaveProperty("view");
  });
});

describe("committedGenresSearch", () => {
  it("normalizes whitespace before committing", () => {
    expect(committedGenresSearch("  наукова   фантастика ")).toBe("наукова фантастика");
  });

  it("ignores a query shorter than two characters", () => {
    expect(committedGenresSearch("ф")).toBe("");
    expect(committedGenresSearch("  ф  ")).toBe("");
  });

  it("commits a two-character query", () => {
    expect(committedGenresSearch("фе")).toBe("фе");
  });
});

describe("toGenresListParams", () => {
  it("sends only the committed identity and omits empty values", () => {
    expect(toGenresListParams(stateFrom("q=ф&sort=name_asc"))).toEqual({
      filter: "all",
      sort: "name_asc",
    });
  });

  it("keeps search, filters and sort together in one identity", () => {
    expect(
      toGenresListParams(stateFrom("q=фе&filter=in_queue&group=fiction&booksMin=3&ratingMax=8")),
    ).toEqual({
      booksMin: 3,
      filter: "in_queue",
      group: ["fiction"],
      q: "фе",
      ratingMax: 8,
      sort: "books_count_desc",
    });
  });

  it("drops an inverted books range rather than asking the API for an invalid query", () => {
    expect(toGenresListParams(stateFrom("booksMin=9&booksMax=2"))).toEqual({
      filter: "all",
      sort: "books_count_desc",
    });
  });
});

describe("toGenresDatasetParams", () => {
  it("excludes the quick filter and sort from the facet identity", () => {
    expect(
      toGenresDatasetParams(stateFrom("q=фе&filter=finished&sort=name_asc&group=fiction")),
    ).toEqual({ group: ["fiction"], q: "фе" });
  });
});

describe("advanced filters", () => {
  it("counts each category once no matter how many values it holds", () => {
    expect(
      activeAdvancedFilterCount({
        booksMax: 10,
        booksMin: 2,
        group: ["fiction", "nonfiction"],
        ratingMax: null,
        ratingMin: 7,
      }),
    ).toBe(3);
  });

  it("normalizes the full rating domain to no rating bound", () => {
    expect(
      normalizeAdvancedFilters({
        ...GENRES_QUERY.emptyAdvanced,
        ratingMax: GENRES_QUERY.rating.max,
        ratingMin: GENRES_QUERY.rating.min,
      }),
    ).toEqual(GENRES_QUERY.emptyAdvanced);
  });

  it("clears an empty group selection from the URL when applied", () => {
    expect(toGenresAdvancedPatch({ ...GENRES_QUERY.emptyAdvanced, booksMin: 4 })).toEqual({
      booksMax: null,
      booksMin: 4,
      group: null,
      ratingMax: null,
      ratingMin: null,
    });
  });

  it("does not treat search or sort as an active filter", () => {
    expect(hasActiveGenresFilters(stateFrom("q=фент&sort=name_asc"))).toBe(false);
    expect(hasActiveGenresFilters(stateFrom("filter=unread"))).toBe(true);
    expect(hasActiveGenresFilters(stateFrom("group=fiction"))).toBe(true);
  });

  it("resets quick and advanced filters but leaves search and sort alone", () => {
    const patch = resetGenresFiltersPatch();

    expect(patch).toEqual({
      booksMax: null,
      booksMin: null,
      filter: null,
      group: null,
      ratingMax: null,
      ratingMin: null,
    });
    expect(patch).not.toHaveProperty("q");
    expect(patch).not.toHaveProperty("sort");
  });
});
