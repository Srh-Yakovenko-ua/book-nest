import { describe, expect, it } from "vitest";

import type { LibraryQueryState } from "./library-query";

import {
  hasActiveLibraryFilters,
  invertedLibraryRanges,
  invertedRangesReset,
  isLibraryRangeValid,
  LIBRARY_FILTERS_RESET,
  libraryQueryParsers,
  libraryRangeFlags,
  toLibraryListParams,
  withoutPublisherFilters,
} from "./library-query";

function makeState(overrides: Partial<LibraryQueryState> = {}): LibraryQueryState {
  return {
    ageCategory: [],
    author: [],
    bookType: null,
    format: [],
    genre: [],
    hasCover: null,
    hasRating: null,
    isFavorite: null,
    language: [],
    owner: [],
    pagesMax: null,
    pagesMin: null,
    publisher: [],
    publisherPresence: "all",
    q: "",
    ratingMax: null,
    ratingMin: null,
    sort: "created_desc",
    status: [],
    tag: [],
    view: "grid",
    yearMax: null,
    yearMin: null,
    ...overrides,
  };
}

describe("publisherPresence", () => {
  it("parses assigned and missing and falls back to all", () => {
    expect(libraryQueryParsers.publisherPresence.parseServerSide("missing")).toBe("missing");
    expect(libraryQueryParsers.publisherPresence.parseServerSide("assigned")).toBe("assigned");
    expect(libraryQueryParsers.publisherPresence.parseServerSide("nobody")).toBe("all");
    expect(libraryQueryParsers.publisherPresence.parseServerSide(undefined)).toBe("all");
  });

  it("forwards only a non-default value to the list request", () => {
    expect(toLibraryListParams(makeState(), "all")).not.toHaveProperty("publisherPresence");
    expect(toLibraryListParams(makeState({ publisherPresence: "missing" }), "all")).toMatchObject({
      publisherPresence: "missing",
    });
  });

  it("counts as an active filter and is cleared by the filter reset", () => {
    expect(hasActiveLibraryFilters(makeState())).toBe(false);
    expect(hasActiveLibraryFilters(makeState({ publisherPresence: "missing" }))).toBe(true);
    expect(LIBRARY_FILTERS_RESET).toHaveProperty("publisherPresence", null);
  });
});

describe("isLibraryRangeValid", () => {
  it("is invalid when both bounds are set and min exceeds max", () => {
    const params = { yearMax: 199, yearMin: 1990 };
    expect(isLibraryRangeValid(params)).toBe(false);
    expect(libraryRangeFlags(params)).toEqual({ pages: false, rating: false, year: true });
  });

  it("is valid when only one bound is set", () => {
    expect(isLibraryRangeValid({ yearMin: 1990 })).toBe(true);
    expect(isLibraryRangeValid({ yearMax: 199 })).toBe(true);
  });

  it("is valid when min does not exceed max", () => {
    const params = {
      pagesMax: 100,
      pagesMin: 100,
      ratingMax: 5,
      ratingMin: 2,
      yearMax: 1990,
      yearMin: 199,
    };
    expect(isLibraryRangeValid(params)).toBe(true);
    expect(libraryRangeFlags(params)).toEqual({ pages: false, rating: false, year: false });
  });
});

describe("invertedLibraryRanges", () => {
  it("reports nothing when no range is set", () => {
    expect(invertedLibraryRanges(makeState())).toEqual([]);
  });

  it("reports nothing when every min is at most its max or only one bound is set", () => {
    const state = makeState({
      pagesMax: 300,
      pagesMin: 300,
      ratingMin: 4,
      yearMax: 2020,
      yearMin: 2000,
    });

    expect(invertedLibraryRanges(state)).toEqual([]);
  });

  it("reports the year range when the year min exceeds the year max", () => {
    const state = makeState({ pagesMax: 500, pagesMin: 100, yearMax: 2000, yearMin: 2020 });

    expect(invertedLibraryRanges(state)).toEqual(["year"]);
  });

  it("lists several inverted ranges in rating, year, pages order", () => {
    const state = makeState({ pagesMax: 100, pagesMin: 500, yearMax: 2000, yearMin: 2020 });

    expect(invertedLibraryRanges(state)).toEqual(["year", "pages"]);
  });

  it("reports the rating range when only the rating is inverted", () => {
    const state = makeState({ pagesMax: 500, pagesMin: 100, ratingMax: 2, ratingMin: 4.5 });

    expect(invertedLibraryRanges(state)).toEqual(["rating"]);
  });
});

describe("invertedRangesReset", () => {
  it("clears both bounds of each inverted range and leaves a valid range out", () => {
    const state = makeState({
      pagesMax: 100,
      pagesMin: 500,
      ratingMax: 5,
      ratingMin: 2,
      yearMax: 2000,
      yearMin: 2020,
    });

    expect(invertedRangesReset(state)).toStrictEqual({
      pagesMax: null,
      pagesMin: null,
      yearMax: null,
      yearMin: null,
    });
  });

  it("changes nothing when no range is inverted", () => {
    const state = makeState({ yearMax: 2020, yearMin: 2000 });

    expect(invertedRangesReset(state)).toStrictEqual({});
  });
});

describe("toLibraryListParams in a publisher context", () => {
  const context = { publisherId: "publisher-fixed" };

  it("pins the fixed publisher and excludes publisher identity from search", () => {
    const params = toLibraryListParams(makeState({ q: "  дюна " }), "all", context);

    expect(params.publisher).toEqual(["publisher-fixed"]);
    expect(params.searchPublisher).toBe("false");
    expect(params.q).toBe("дюна");
  });

  it("ignores url publisher and publisherPresence so the scope cannot escape", () => {
    const params = toLibraryListParams(
      makeState({ publisher: ["publisher-other"], publisherPresence: "missing" }),
      "all",
      context,
    );

    expect(params.publisher).toEqual(["publisher-fixed"]);
    expect(params).not.toHaveProperty("publisherPresence");
  });

  it("keeps the canonical params without a context", () => {
    const params = toLibraryListParams(
      makeState({ publisher: ["publisher-other"], publisherPresence: "missing" }),
      "all",
    );

    expect(params.publisher).toEqual(["publisher-other"]);
    expect(params.publisherPresence).toBe("missing");
    expect(params).not.toHaveProperty("searchPublisher");
  });

  it("never counts the fixed publisher as an active filter", () => {
    const state = withoutPublisherFilters(
      makeState({ publisher: ["publisher-other"], publisherPresence: "missing" }),
    );

    expect(hasActiveLibraryFilters(state)).toBe(false);
  });
});
