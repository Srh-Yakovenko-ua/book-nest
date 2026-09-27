import { describe, expect, it } from "vitest";

import type { LibraryQueryState } from "./library-query";

import { libraryQueryParsers, toLibraryListParams } from "./library-query";
import { toLibraryQuickCountsParams } from "./library-quick-filters";

const PUBLISHER_ID = "11111111-1111-4111-8111-111111111111";
const TAG_ID = "22222222-2222-4222-8222-222222222222";

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
    publisherPresence: libraryQueryParsers.publisherPresence.defaultValue,
    q: "",
    ratingMax: null,
    ratingMin: null,
    sort: libraryQueryParsers.sort.defaultValue,
    status: [],
    tag: [],
    view: libraryQueryParsers.view.defaultValue,
    yearMax: null,
    yearMin: null,
    ...overrides,
  };
}

describe("toLibraryQuickCountsParams", () => {
  it("keeps the search and advanced filters the list sends", () => {
    const listParams = toLibraryListParams(
      makeState({ format: ["ebook"], q: "  дюна ", tag: [TAG_ID], yearMin: 1990 }),
      "all",
    );

    expect(toLibraryQuickCountsParams(listParams, "all")).toEqual({
      ageCategory: [],
      author: [],
      format: ["ebook"],
      genre: [],
      language: [],
      publisher: [],
      q: "дюна",
      scope: "all",
      tag: [TAG_ID],
      yearMin: 1990,
    });
  });

  it("drops paging, sort and every quick filter axis", () => {
    const listParams = toLibraryListParams(
      makeState({
        bookType: "series_part",
        isFavorite: true,
        owner: ["want_to_buy"],
        sort: "title_asc",
        status: ["finished"],
      }),
      "all",
    );

    const params = toLibraryQuickCountsParams(listParams, "all");

    expect(params).not.toHaveProperty("bookType");
    expect(params).not.toHaveProperty("isFavorite");
    expect(params).not.toHaveProperty("owner");
    expect(params).not.toHaveProperty("status");
    expect(params).not.toHaveProperty("sort");
    expect(params).not.toHaveProperty("pageSize");
  });

  it("replaces the physical ownership base with scope my", () => {
    const params = toLibraryQuickCountsParams(toLibraryListParams(makeState(), "my"), "my");

    expect(params.scope).toBe("my");
    expect(params).not.toHaveProperty("owner");
  });

  it("replaces the forced favorite filter with scope favorites", () => {
    const params = toLibraryQuickCountsParams(
      toLibraryListParams(makeState(), "favorites"),
      "favorites",
    );

    expect(params.scope).toBe("favorites");
    expect(params).not.toHaveProperty("isFavorite");
  });

  it("keeps the fixed publisher of a publisher page", () => {
    const listParams = toLibraryListParams(makeState({ publisher: ["other"] }), "all", {
      publisherId: PUBLISHER_ID,
    });

    const params = toLibraryQuickCountsParams(listParams, "all");

    expect(params.publisher).toEqual([PUBLISHER_ID]);
    expect(params.searchPublisher).toBe("false");
  });
});
