import type { CustomListBooksQuery } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  buildListBookFilter,
  clearQuickFilterAxes,
  hasQuickFilterAxis,
} from "./list-book-filter.js";

function filterFor(
  overrides: Partial<CustomListBooksQuery> = {},
  extras: { search?: string; searchGenreKeys?: string[] } = {},
) {
  return buildListBookFilter({
    query: query(overrides),
    search: extras.search,
    searchGenreKeys: extras.searchGenreKeys,
    userId: "user-1",
  });
}

function query(overrides: Partial<CustomListBooksQuery> = {}): CustomListBooksQuery {
  return { pageNumber: 1, pageSize: 10, sort: "position", tab: "all", ...overrides };
}

describe("buildListBookFilter", () => {
  it("scopes the query to the owner of the list", () => {
    expect(filterFor().userId).toBe("user-1");
  });

  it("leaves every optional filter unset when nothing is selected", () => {
    expect(filterFor()).toEqual({ userId: "user-1" });
  });

  it("filters by the selected authors", () => {
    expect(filterFor({ author: ["author-1", "author-2"] }).authorIds).toEqual([
      "author-1",
      "author-2",
    ]);
  });

  it("filters by the selected formats", () => {
    expect(filterFor({ format: ["paper", "audiobook"] }).formats).toEqual(["paper", "audiobook"]);
  });

  it("filters by the selected genres", () => {
    expect(filterFor({ genre: ["fantasy", "history"] }).genreKeys).toEqual(["fantasy", "history"]);
  });

  it("filters by the selected ownership statuses", () => {
    expect(filterFor({ owner: ["owned", "want_to_buy"] }).ownershipStatuses).toEqual([
      "owned",
      "want_to_buy",
    ]);
  });

  it("filters by the selected book type", () => {
    expect(filterFor({ bookType: "series_part" }).bookType).toBe("series_part");
  });

  it("filters by books that are queued for reading", () => {
    expect(filterFor({ inQueue: true }).inQueue).toBe(true);
  });

  it("filters by books that are kept out of the reading queue", () => {
    expect(filterFor({ inQueue: false }).inQueue).toBe(false);
  });

  it("filters by favorite books", () => {
    expect(filterFor({ isFavorite: true }).isFavorite).toBe(true);
  });

  it("filters by books that are not favorites", () => {
    expect(filterFor({ isFavorite: false }).isFavorite).toBe(false);
  });

  it("passes the normalized search term through untouched", () => {
    expect(filterFor({}, { search: "dune" }).search).toBe("dune");
  });

  it("passes the genres matched by the search term through untouched", () => {
    expect(filterFor({}, { searchGenreKeys: ["sci_fi"] }).searchGenreKeys).toEqual(["sci_fi"]);
  });

  it("turns the active tab into the matching reading statuses", () => {
    expect(filterFor({ tab: "not_started" }).readingStatuses).toEqual([
      "not_started",
      "want_to_read",
    ]);
  });

  it("prefers an explicit status selection over the active tab", () => {
    expect(filterFor({ status: ["dnf"], tab: "finished" }).readingStatuses).toEqual(["dnf"]);
  });

  it("filters by no reading status on the all tab", () => {
    expect(filterFor({ tab: "all" }).readingStatuses).toBeUndefined();
  });

  it("carries every selected facet in a single pass", () => {
    expect(
      filterFor(
        {
          author: ["author-1"],
          bookType: "solo",
          format: ["ebook"],
          genre: ["fantasy"],
          inQueue: true,
          isFavorite: true,
          owner: ["owned"],
          tab: "reading",
        },
        { search: "dune", searchGenreKeys: ["sci_fi"] },
      ),
    ).toEqual({
      authorIds: ["author-1"],
      bookType: "solo",
      formats: ["ebook"],
      genreKeys: ["fantasy"],
      inQueue: true,
      isFavorite: true,
      ownershipStatuses: ["owned"],
      readingStatuses: ["reading", "rereading"],
      search: "dune",
      searchGenreKeys: ["sci_fi"],
      userId: "user-1",
    });
  });
});

describe("clearQuickFilterAxes", () => {
  it("drops every axis the quick filter chips own", () => {
    const cleared = clearQuickFilterAxes(
      filterFor({ bookType: "series_part", inQueue: true, isFavorite: true, tab: "reading" }),
    );

    expect(cleared.bookType).toBeUndefined();
    expect(cleared.inQueue).toBeUndefined();
    expect(cleared.isFavorite).toBeUndefined();
    expect(cleared.readingStatuses).toBeUndefined();
  });

  it("keeps every filter the chips do not own", () => {
    const cleared = clearQuickFilterAxes(
      filterFor(
        { author: ["author-1"], format: ["ebook"], isFavorite: true, owner: ["owned"] },
        { search: "dune" },
      ),
    );

    expect(cleared).toEqual({
      authorIds: ["author-1"],
      formats: ["ebook"],
      ownershipStatuses: ["owned"],
      search: "dune",
      userId: "user-1",
    });
  });

  it("leaves the original filter untouched", () => {
    const filter = filterFor({ isFavorite: true });

    clearQuickFilterAxes(filter);

    expect(filter.isFavorite).toBe(true);
  });
});

describe("hasQuickFilterAxis", () => {
  it("reports no quick filter for an unfiltered list", () => {
    expect(hasQuickFilterAxis(filterFor())).toBe(false);
  });

  it("reports no quick filter when only filters outside the chip group are set", () => {
    expect(hasQuickFilterAxis(filterFor({ genre: ["fantasy"], owner: ["owned"] }))).toBe(false);
  });

  it("reports a quick filter for the reading statuses of a tab", () => {
    expect(hasQuickFilterAxis(filterFor({ tab: "finished" }))).toBe(true);
  });

  it("reports a quick filter for favourites", () => {
    expect(hasQuickFilterAxis(filterFor({ isFavorite: true }))).toBe(true);
  });

  it("reports a quick filter for books kept out of the reading queue", () => {
    expect(hasQuickFilterAxis(filterFor({ inQueue: false }))).toBe(true);
  });

  it("reports a quick filter for series parts", () => {
    expect(hasQuickFilterAxis(filterFor({ bookType: "series_part" }))).toBe(true);
  });
});
