import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bookKeys } from "@/features/books/api/book-keys";
import {
  makeBookDetailsView,
  makeBookView,
} from "@/features/books/components/book-details.fixtures";
import { queryClientWrapper } from "@/test-query-cache";

import { useToggleFavoriteDedication } from "./use-toggle-favorite-dedication";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useToggleFavoriteDedication", () => {
  it("keeps the cached notes and quotes counts after the book comes back without them", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(
      bookKeys.detail(BOOK_ID),
      makeBookDetailsView({
        id: BOOK_ID,
        isFavoriteDedication: false,
        notesCount: 4,
        quotesCount: 9,
      }),
    );
    fetchMock.mockResolvedValue(
      jsonResponse(makeBookView({ id: BOOK_ID, isFavoriteDedication: true })),
    );
    const { result } = renderHook(() => useToggleFavoriteDedication(), {
      wrapper: queryClientWrapper(client),
    });

    await act(() => result.current.mutateAsync({ id: BOOK_ID, isFavoriteDedication: true }));

    expect(client.getQueryData(bookKeys.detail(BOOK_ID))).toMatchObject({
      isFavoriteDedication: true,
      notesCount: 4,
      quotesCount: 9,
    });
  });

  it("does not cache a book without a notes count when no detail was cached", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    fetchMock.mockResolvedValue(
      jsonResponse(makeBookView({ id: BOOK_ID, isFavoriteDedication: true })),
    );
    const { result } = renderHook(() => useToggleFavoriteDedication(), {
      wrapper: queryClientWrapper(client),
    });

    await act(() => result.current.mutateAsync({ id: BOOK_ID, isFavoriteDedication: true }));

    expect(client.getQueryData(bookKeys.detail(BOOK_ID))).toBeUndefined();
  });

  it("invalidates a detail query that has no data yet instead of writing a partial book", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const detailKey = bookKeys.detail(BOOK_ID);
    client.getQueryCache().build(client, { queryKey: detailKey });
    fetchMock.mockResolvedValue(
      jsonResponse(makeBookView({ id: BOOK_ID, isFavoriteDedication: true })),
    );
    const { result } = renderHook(() => useToggleFavoriteDedication(), {
      wrapper: queryClientWrapper(client),
    });

    await act(() => result.current.mutateAsync({ id: BOOK_ID, isFavoriteDedication: true }));

    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(client.getQueryData(detailKey)).toBeUndefined();
  });

  it("refreshes the book detail and book lists after a failed toggle", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const detailKey = bookKeys.detail(BOOK_ID);
    const listKey = ["/api/books", "list", { page: 1 }];
    client.setQueryData(detailKey, makeBookDetailsView({ id: BOOK_ID }));
    client.setQueryData(listKey, {});
    fetchMock.mockResolvedValue(jsonResponse({ message: "Internal server error" }, 500));
    const { result } = renderHook(() => useToggleFavoriteDedication(), {
      wrapper: queryClientWrapper(client),
    });

    await act(() =>
      result.current
        .mutateAsync({ id: BOOK_ID, isFavoriteDedication: true })
        .catch(() => undefined),
    );

    expect([detailKey, listKey].map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([
      true,
      true,
    ]);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
