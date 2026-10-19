import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookDetailsView, makeBookView } from "../components/book-details.fixtures";
import { bookKeys } from "./book-keys";
import { useToggleFavorite } from "./use-book-actions";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useToggleFavorite", () => {
  it("keeps the cached notes and quotes counts when it flips the favorite on the detail", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const cachedDetail = makeBookDetailsView({
      id: BOOK_ID,
      isFavorite: false,
      notesCount: 5,
      quotesCount: 8,
    });
    client.setQueryData(bookKeys.detail(BOOK_ID), cachedDetail);
    fetchMock.mockResolvedValue(jsonResponse(makeBookView({ id: BOOK_ID, isFavorite: true })));
    const { result } = renderHook(() => useToggleFavorite(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ id: BOOK_ID, isFavorite: true }));

    expect(client.getQueryData(bookKeys.detail(BOOK_ID))).toEqual({
      ...cachedDetail,
      isFavorite: true,
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
