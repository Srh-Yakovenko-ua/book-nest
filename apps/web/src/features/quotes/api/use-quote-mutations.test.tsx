import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bookKeys } from "@/features/books/api/book-keys";

import { makeQuote } from "../model/quotes.fixtures";
import { useCreateQuote, useDeleteQuote, useUpdateQuote } from "./use-quote-mutations";

const QUOTE = makeQuote();

const SEEDED_KEYS = {
  bookDetail: bookKeys.detail(QUOTE.bookId),
  otherBookChapters: bookKeys.chapters("book-2"),
  quotedBookChapters: bookKeys.chapters(QUOTE.bookId),
} as const;

const STALE_QUOTED_BOOK_CHAPTERS_ONLY = {
  bookDetail: false,
  otherBookChapters: false,
  quotedBookChapters: true,
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("quote mutations refresh the chapter suggestions", () => {
  it("marks only the quoted book's chapters stale after a quote is created", async () => {
    replyWith(QUOTE);
    const client = seededClient();
    const { result } = renderHook(() => useCreateQuote(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({
        bookId: QUOTE.bookId,
        input: { chapter: "Пролог", isFavorite: false, isSpoiler: false, text: QUOTE.text },
      }),
    );

    expect(invalidation(client)).toEqual(STALE_QUOTED_BOOK_CHAPTERS_ONLY);
  });

  it("marks only the quoted book's chapters stale after a quote is updated", async () => {
    replyWith(makeQuote({ chapter: "Пролог" }));
    const client = seededClient();
    const { result } = renderHook(() => useUpdateQuote(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({
        bookId: QUOTE.bookId,
        input: { chapter: "Пролог" },
        quoteId: QUOTE.id,
      }),
    );

    expect(invalidation(client)).toEqual(STALE_QUOTED_BOOK_CHAPTERS_ONLY);
  });

  it("marks only the quoted book's chapters stale after a quote is deleted", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = seededClient();
    const { result } = renderHook(() => useDeleteQuote(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ bookId: QUOTE.bookId, quoteId: QUOTE.id }));

    expect(invalidation(client)).toEqual(STALE_QUOTED_BOOK_CHAPTERS_ONLY);
  });
});

function invalidation(client: QueryClient) {
  return {
    bookDetail: isInvalidated(client, SEEDED_KEYS.bookDetail),
    otherBookChapters: isInvalidated(client, SEEDED_KEYS.otherBookChapters),
    quotedBookChapters: isInvalidated(client, SEEDED_KEYS.quotedBookChapters),
  };
}

function isInvalidated(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}

function replyWith(body: unknown) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
    ),
  );
}

function seededClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const key of Object.values(SEEDED_KEYS)) client.setQueryData(key, {});
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
