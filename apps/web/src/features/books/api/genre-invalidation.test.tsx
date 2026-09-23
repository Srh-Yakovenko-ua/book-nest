import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { genresKeys } from "@/features/genres/api/genres-keys";

import { makeBookView } from "../components/book-details.fixtures";
import { useBulkReadingStatus, useDeleteBook, useToggleFavorite } from "./use-book-actions";
import { useChangeReadingStatus } from "./use-reading-progress";
import { RECENT_GENRES_KEY } from "./use-recent-genres";
import { useUpdateBook } from "./use-update-book";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const GENRE_KEYS = {
  catalog: ["genres"],
  facets: genresKeys.facets({}),
  overview: genresKeys.overview,
  recent: RECENT_GENRES_KEY,
  stats: genresKeys.stats({ filter: "all", sort: "books_count_desc" }),
  summary: genresKeys.summary,
} as const;

const DERIVED_KEYS = [
  GENRE_KEYS.stats,
  GENRE_KEYS.facets,
  GENRE_KEYS.summary,
  GENRE_KEYS.overview,
] as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("book mutations and the Genres page", () => {
  it("refreshes Genre analytics and recent usage after a book edit", async () => {
    replyWith({});
    const client = seededClient();
    const { result } = renderHook(() => useUpdateBook(BOOK_ID), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ genres: ["fantasy"] }));

    expect(derivedInvalidation(client)).toEqual([true, true, true, true]);
    expect(isInvalidated(client, GENRE_KEYS.recent)).toBe(true);
    expect(isInvalidated(client, GENRE_KEYS.catalog)).toBe(false);
  });

  it("refreshes Genre analytics and recent usage after deleting a book", async () => {
    replyWith({});
    const client = seededClient();
    const { result } = renderHook(() => useDeleteBook(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync(BOOK_ID));

    expect(derivedInvalidation(client)).toEqual([true, true, true, true]);
    expect(isInvalidated(client, GENRE_KEYS.recent)).toBe(true);
  });

  it("refreshes Genre analytics after a reading-status change without touching recent usage", async () => {
    replyWith(makeBookView({ id: BOOK_ID }));
    const client = seededClient();
    const { result } = renderHook(() => useChangeReadingStatus(), {
      wrapper: wrapperFor(client),
    });

    await act(() => result.current.mutateAsync({ id: BOOK_ID, payload: { status: "finished" } }));

    expect(derivedInvalidation(client)).toEqual([true, true, true, true]);
    expect(isInvalidated(client, GENRE_KEYS.recent)).toBe(false);
    expect(isInvalidated(client, GENRE_KEYS.catalog)).toBe(false);
  });

  it("refreshes Genre analytics after a bulk reading-status change", async () => {
    replyWith({ affected: 2 });
    const client = seededClient();
    const { result } = renderHook(() => useBulkReadingStatus(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ bookIds: [BOOK_ID], readingStatus: "finished" }));

    expect(derivedInvalidation(client)).toEqual([true, true, true, true]);
  });

  it("leaves Genre analytics alone when only a favorite changes", async () => {
    replyWith({});
    const client = seededClient();
    const { result } = renderHook(() => useToggleFavorite(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ id: BOOK_ID, isFavorite: true }));

    expect(derivedInvalidation(client)).toEqual([false, false, false, false]);
  });
});

function derivedInvalidation(client: QueryClient): boolean[] {
  return DERIVED_KEYS.map((key) => isInvalidated(client, key));
}

function isInvalidated(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}

function replyWith(body: unknown) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    ),
  );
}

function seededClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const key of Object.values(GENRE_KEYS)) client.setQueryData(key, {});
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
