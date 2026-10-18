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
  libraryList: [...bookKeys.root, "list", { pageNumber: 1 }, "active"],
  otherBookChapters: bookKeys.chapters("book-2"),
  otherBookDetail: bookKeys.detail("book-2"),
  quotedBookChapters: bookKeys.chapters(QUOTE.bookId),
  quotedBookDeliveryHistory: bookKeys.deliveryHistory(QUOTE.bookId),
} as const;

const STALE_QUOTED_BOOK_CHAPTERS_ONLY = {
  bookDetail: false,
  libraryList: false,
  otherBookChapters: false,
  otherBookDetail: false,
  quotedBookChapters: true,
  quotedBookDeliveryHistory: false,
} as const;

const STALE_QUOTED_BOOK_DETAIL_AND_CHAPTERS = {
  ...STALE_QUOTED_BOOK_CHAPTERS_ONLY,
  bookDetail: true,
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("quote mutations refresh the chapter suggestions and the quote count", () => {
  it("marks the quoted book's detail and chapters stale after a quote is created", async () => {
    replyWith(QUOTE);
    const client = seededClient();
    const { result } = renderHook(() => useCreateQuote(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({
        bookId: QUOTE.bookId,
        input: { chapter: "Пролог", isFavorite: false, isSpoiler: false, text: QUOTE.text },
      }),
    );

    expect(invalidation(client)).toEqual(STALE_QUOTED_BOOK_DETAIL_AND_CHAPTERS);
  });

  it("keeps the book detail fresh and marks only its chapters stale after a quote is updated", async () => {
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

  it("marks the quoted book's detail and chapters stale after a quote is deleted", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = seededClient();
    const { result } = renderHook(() => useDeleteQuote(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ bookId: QUOTE.bookId, quoteId: QUOTE.id }));

    expect(invalidation(client)).toEqual(STALE_QUOTED_BOOK_DETAIL_AND_CHAPTERS);
  });
});

function invalidation(client: QueryClient) {
  return {
    bookDetail: isInvalidated(client, SEEDED_KEYS.bookDetail),
    libraryList: isInvalidated(client, SEEDED_KEYS.libraryList),
    otherBookChapters: isInvalidated(client, SEEDED_KEYS.otherBookChapters),
    otherBookDetail: isInvalidated(client, SEEDED_KEYS.otherBookDetail),
    quotedBookChapters: isInvalidated(client, SEEDED_KEYS.quotedBookChapters),
    quotedBookDeliveryHistory: isInvalidated(client, SEEDED_KEYS.quotedBookDeliveryHistory),
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
