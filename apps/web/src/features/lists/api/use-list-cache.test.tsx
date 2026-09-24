import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { genresKeys } from "@/features/genres/api/genres-keys";

import { useSetListBookReadingStatus } from "./use-list-book-actions";
import { useBulkAddListBooksToQueue } from "./use-list-bulk";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const LIST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOOK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const GENRE_DERIVED_KEYS = [
  genresKeys.stats({ filter: "all", sort: "books_count_desc" }),
  genresKeys.facets({}),
  genresKeys.summary,
  genresKeys.overview,
] as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("list mutations and the Genres page", () => {
  it("refreshes Genre analytics after a reading-status change from a list", async () => {
    replyWith(makeBookView({ id: BOOK_ID }));
    const client = seededClient();
    const { result } = renderHook(() => useSetListBookReadingStatus(LIST_ID), {
      wrapper: wrapperFor(client),
    });

    await act(() => result.current.mutateAsync({ bookId: BOOK_ID, readingStatus: "finished" }));

    expect(derivedInvalidation(client)).toEqual([true, true, true, true]);
  });

  it("refreshes Genre analytics after queueing list books", async () => {
    replyWith({ affected: 1 });
    const client = seededClient();
    const { result } = renderHook(() => useBulkAddListBooksToQueue(LIST_ID), {
      wrapper: wrapperFor(client),
    });

    await act(() => result.current.mutateAsync([BOOK_ID]));

    expect(derivedInvalidation(client)).toEqual([true, true, true, true]);
  });
});

function derivedInvalidation(client: QueryClient): boolean[] {
  return GENRE_DERIVED_KEYS.map((key) => client.getQueryState(key)?.isInvalidated ?? false);
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
  for (const key of GENRE_DERIVED_KEYS) client.setQueryData(key, {});
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
