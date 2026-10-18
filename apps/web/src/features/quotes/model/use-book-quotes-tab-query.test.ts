import type { UrlUpdateEvent } from "nuqs/adapters/testing";

import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { useBookQuotesTabQuery } from "./use-book-quotes-tab-query";

const BOOK_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const OTHER_BOOK_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const ACTIVE_URL =
  "?tab=quotes&noteQ=дюна&characterSearch=пол&quoteQ=страх&quoteFilter=favorites&quoteSort=oldest";

function lastUrl(onUrlUpdate: ReturnType<typeof renderTabQuery>["onUrlUpdate"]): URLSearchParams {
  const event = onUrlUpdate.mock.lastCall?.[0];
  if (event === undefined) throw new Error("the URL was never updated");
  return event.searchParams;
}

function renderTabQuery(searchParams: string) {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  const view = renderHook(() => useBookQuotesTabQuery(BOOK_ID), {
    wrapper: withNuqsTestingAdapter({ hasMemory: true, onUrlUpdate, searchParams }),
  });
  return { onUrlUpdate, ...view };
}

describe("useBookQuotesTabQuery", () => {
  it("separates an active search from an active filter", () => {
    const { result } = renderTabQuery("?quoteQ=a");

    expect(result.current.hasActiveSearch).toBe(true);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.listParams).toMatchObject({ q: "a" });
  });

  it("treats a whitespace-only search as no search", () => {
    const { result } = renderTabQuery("?quoteQ=%20%20%20");

    expect(result.current.hasActiveSearch).toBe(false);
    expect(result.current.listParams).not.toHaveProperty("q");
  });

  it("resets the filter but keeps the search, the sort and the other tabs' keys", async () => {
    const { onUrlUpdate, result } = renderTabQuery(ACTIVE_URL);

    act(() => result.current.clearFilters());

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(Object.fromEntries(lastUrl(onUrlUpdate))).toEqual({
      characterSearch: "пол",
      noteQ: "дюна",
      quoteQ: "страх",
      quoteSort: "oldest",
      tab: "quotes",
    });
  });

  it("clears the search but keeps the filter and the sort", async () => {
    const { onUrlUpdate, result } = renderTabQuery(ACTIVE_URL);

    act(() => result.current.clearSearch());

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(Object.fromEntries(lastUrl(onUrlUpdate))).toEqual({
      characterSearch: "пол",
      noteQ: "дюна",
      quoteFilter: "favorites",
      quoteSort: "oldest",
      tab: "quotes",
    });
  });

  it("keeps the book scope from the page whatever the archive keys say", () => {
    const { result } = renderTabQuery(`?book=${OTHER_BOOK_ID}&bookId=${OTHER_BOOK_ID}&q=дюна`);

    expect(result.current.listParams).toEqual({
      book: [BOOK_ID],
      filter: "all",
      pageSize: 20,
      searchIn: "quotes",
      sort: "page",
    });
    expect(result.current.facetsParams).toEqual({ book: [BOOK_ID], searchIn: "quotes" });
  });
});
