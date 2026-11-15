import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { getBooksControllerFacetsQueryKey } from "@/shared/api/generated/endpoints/books/books";
import { getSeriesControllerFavoriteContinuationsQueryKey } from "@/shared/api/generated/endpoints/series/series";

import { bookKeys, invalidateBookQueries, matchesBooksExceptDetail } from "./book-keys";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_BOOK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const FACETS_KEY = getBooksControllerFacetsQueryKey({ scope: "all" });

function isInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]): boolean {
  return queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
}

describe("matchesBooksExceptDetail", () => {
  it("matches the generated facets key that lives under /api/books", () => {
    expect(matchesBooksExceptDetail(BOOK_ID)({ queryKey: FACETS_KEY })).toBe(true);
  });

  it("skips the detail of the given book and keeps the detail of any other book", () => {
    const matches = matchesBooksExceptDetail(BOOK_ID);

    expect(matches({ queryKey: bookKeys.detail(BOOK_ID) })).toBe(false);
    expect(matches({ queryKey: bookKeys.detail(OTHER_BOOK_ID) })).toBe(true);
  });
});

describe("invalidateBookQueries", () => {
  it("invalidates the generated facets query", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(FACETS_KEY, {});

    await invalidateBookQueries(queryClient);

    expect(isInvalidated(queryClient, FACETS_KEY)).toBe(true);
  });

  it("leaves queries of other resources fresh", async () => {
    const queryClient = new QueryClient();
    const seriesKey = getSeriesControllerFavoriteContinuationsQueryKey({ limit: 50 });
    queryClient.setQueryData(seriesKey, {});

    await invalidateBookQueries(queryClient);

    expect(isInvalidated(queryClient, seriesKey)).toBe(false);
  });
});
