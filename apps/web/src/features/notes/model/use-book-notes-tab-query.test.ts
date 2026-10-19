import type { UrlUpdateEvent } from "nuqs/adapters/testing";

import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { useBookNotesTabQuery } from "./use-book-notes-tab-query";

const BOOK_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ACTIVE_URL =
  "?tab=notes&characterSearch=paul&noteQ=dune&noteFilter=pinned&noteSort=oldest&noteCategory=plot&noteCustomCategory=Lore";

function lastUrl(onUrlUpdate: ReturnType<typeof renderTabQuery>["onUrlUpdate"]): URLSearchParams {
  const event = onUrlUpdate.mock.lastCall?.[0];
  if (event === undefined) throw new Error("the URL was never updated");
  return event.searchParams;
}

function renderTabQuery(searchParams: string) {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  const view = renderHook(() => useBookNotesTabQuery(BOOK_ID), {
    wrapper: withNuqsTestingAdapter({ hasMemory: true, onUrlUpdate, searchParams }),
  });
  return { onUrlUpdate, ...view };
}

describe("useBookNotesTabQuery", () => {
  it("separates an active search from active filters", () => {
    const { result } = renderTabQuery("?noteQ=dune");

    expect(result.current.hasActiveSearch).toBe(true);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("clears the categories without touching search, filter, sort or the tab", async () => {
    const { onUrlUpdate, result } = renderTabQuery(ACTIVE_URL);

    act(() => result.current.setCategories({ category: [], customCategory: [] }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(Object.fromEntries(lastUrl(onUrlUpdate))).toEqual({
      characterSearch: "paul",
      noteFilter: "pinned",
      noteQ: "dune",
      noteSort: "oldest",
      tab: "notes",
    });
  });

  it("resets the filters but keeps the search", async () => {
    const { onUrlUpdate, result } = renderTabQuery(ACTIVE_URL);

    act(() => result.current.clearFilters());

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(Object.fromEntries(lastUrl(onUrlUpdate))).toEqual({
      characterSearch: "paul",
      noteQ: "dune",
      noteSort: "oldest",
      tab: "notes",
    });
  });

  it("clears the search but keeps the filters", async () => {
    const { onUrlUpdate, result } = renderTabQuery(ACTIVE_URL);

    act(() => result.current.clearSearch());

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(lastUrl(onUrlUpdate).has("noteQ")).toBe(false);
    expect(lastUrl(onUrlUpdate).get("noteFilter")).toBe("pinned");
  });

  it("keeps the book scope after clearing the filters and the search", async () => {
    const { onUrlUpdate, result } = renderTabQuery(ACTIVE_URL);

    act(() => result.current.clearFilters());
    act(() => result.current.clearSearch());

    await waitFor(() => expect(result.current.state.noteQ).toBe(""));
    expect(Object.fromEntries(lastUrl(onUrlUpdate))).toEqual({
      characterSearch: "paul",
      noteSort: "oldest",
      tab: "notes",
    });
    expect(result.current.listParams).toMatchObject({ book: [BOOK_ID], searchIn: "notes" });
    expect(result.current.facetsParams).toEqual({ book: [BOOK_ID], searchIn: "notes" });
  });
});
