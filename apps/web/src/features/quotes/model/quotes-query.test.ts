import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";

import {
  getQuotesControllerFacetsUrl,
  getQuotesControllerListUrl,
} from "@/shared/api/generated/endpoints/quotes/quotes";

import type { QuotesQueryState } from "./quotes-query";

import { quoteKeys } from "../api/quote-keys";
import { quotesQueryParsers, toQuotesFacetsParams, toQuotesListParams } from "./quotes-query";

const loadQuotesQuery = createLoader(quotesQueryParsers);

function stateFrom(search: string): QuotesQueryState {
  return loadQuotesQuery(new URLSearchParams(search));
}

const FULL_ARCHIVE_SEARCH =
  "q=%20dream%20&book=book-1&bookId=book-2&author=author-1&createdFrom=2026-01-01&createdTo=2026-02-01&filter=favorites&sort=oldest";

describe("quotes archive request params", () => {
  it("sends no searchIn from the default archive state", () => {
    const state = stateFrom("");

    expect(toQuotesFacetsParams(state)).toStrictEqual({});
    expect(toQuotesListParams(state)).toStrictEqual({
      filter: "all",
      pageSize: 12,
      sort: "newest",
    });
  });

  it("sends no searchIn when every archive criterion is set", () => {
    const state = stateFrom(FULL_ARCHIVE_SEARCH);

    expect(toQuotesFacetsParams(state)).toStrictEqual({
      author: ["author-1"],
      book: ["book-1", "book-2"],
      createdFrom: "2026-01-01",
      createdTo: "2026-02-01",
      q: "dream",
    });
    expect(toQuotesListParams(state)).toStrictEqual({
      author: ["author-1"],
      book: ["book-1", "book-2"],
      createdFrom: "2026-01-01",
      createdTo: "2026-02-01",
      filter: "favorites",
      pageSize: 12,
      q: "dream",
      sort: "oldest",
    });
  });

  it("keeps the archive cache keys free of searchIn", () => {
    const state = stateFrom(FULL_ARCHIVE_SEARCH);

    expect(quoteKeys.list(toQuotesListParams(stateFrom("")))).toStrictEqual([
      "/api/quotes",
      "list",
      { filter: "all", pageSize: 12, sort: "newest" },
    ]);
    expect(quoteKeys.facets(toQuotesFacetsParams(stateFrom("")))).toStrictEqual([
      "/api/quotes",
      "facets",
      {},
    ]);
    expect(JSON.stringify(quoteKeys.list(toQuotesListParams(state)))).not.toContain("searchIn");
    expect(JSON.stringify(quoteKeys.facets(toQuotesFacetsParams(state)))).not.toContain("searchIn");
  });

  it("builds the archive request URLs without searchIn", () => {
    expect(
      getQuotesControllerListUrl({ ...toQuotesListParams(stateFrom("")), pageNumber: 1 }),
    ).toBe("/api/quotes?filter=all&pageSize=12&sort=newest&pageNumber=1");
    expect(getQuotesControllerFacetsUrl(toQuotesFacetsParams(stateFrom("")))).toBe(
      "/api/quotes/facets",
    );
    expect(
      getQuotesControllerListUrl({
        ...toQuotesListParams(stateFrom(FULL_ARCHIVE_SEARCH)),
        pageNumber: 2,
      }),
    ).not.toContain("searchIn");
    expect(
      getQuotesControllerFacetsUrl(toQuotesFacetsParams(stateFrom(FULL_ARCHIVE_SEARCH))),
    ).not.toContain("searchIn");
  });
});
