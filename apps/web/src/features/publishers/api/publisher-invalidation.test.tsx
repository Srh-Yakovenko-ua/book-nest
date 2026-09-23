import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteStoreLink } from "@/features/books-to-buy/api/use-store-links";
import { useDeleteBook, useToggleFavorite } from "@/features/books/api/use-book-actions";
import { useChangeReadingStatus } from "@/features/books/api/use-reading-progress";
import { useUpdateBook } from "@/features/books/api/use-update-book";
import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { useDeleteSeries } from "@/features/series/api/use-delete-series";

import { invalidatePublisherQueries, publisherKeys } from "./publisher-keys";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const CACHE_KEYS = {
  detail: publisherKeys.detail("publisher-1"),
  generated: ["/api/publishers/library/summary"],
  picker: ["publishers", "search", "viv"],
} as const;

function isInvalidated(client: QueryClient, key: readonly unknown[]): boolean {
  return client.getQueryState(key)?.isInvalidated === true;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function seededClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  for (const key of Object.values(CACHE_KEYS)) client.setQueryData(key, { marker: key });
  return client;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("invalidatePublisherQueries", () => {
  it("invalidates every /api/publishers query and leaves the picker alone", async () => {
    const client = seededClient();

    await invalidatePublisherQueries(client);

    expect(isInvalidated(client, CACHE_KEYS.detail)).toBe(true);
    expect(isInvalidated(client, CACHE_KEYS.generated)).toBe(true);
    expect(isInvalidated(client, CACHE_KEYS.picker)).toBe(false);
  });
});

describe("publisher cache freshness after related mutations", () => {
  it("invalidates publishers after a reading-status change", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeBookView()));
    const client = seededClient();

    const { result } = renderHook(() => useChangeReadingStatus(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ id: makeBookView().id, payload: { status: "finished" } });

    await waitFor(() => expect(isInvalidated(client, CACHE_KEYS.detail)).toBe(true));
  });

  it("invalidates publishers after a book update", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeBookView()));
    const client = seededClient();

    const { result } = renderHook(() => useUpdateBook(makeBookView().id), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ title: "Renamed" });

    await waitFor(() => expect(isInvalidated(client, CACHE_KEYS.detail)).toBe(true));
  });

  it("invalidates publishers after a book delete", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = seededClient();

    const { result } = renderHook(() => useDeleteBook(), { wrapper: makeWrapper(client) });
    result.current.mutate(makeBookView().id);

    await waitFor(() => expect(isInvalidated(client, CACHE_KEYS.detail)).toBe(true));
  });

  it("invalidates publishers after a store link is removed", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = seededClient();

    const { result } = renderHook(() => useDeleteStoreLink(), { wrapper: makeWrapper(client) });
    result.current.mutate({ bookId: makeBookView().id, linkId: "link-1" });

    await waitFor(() => expect(isInvalidated(client, CACHE_KEYS.detail)).toBe(true));
  });

  it("invalidates publishers after a series is deleted", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = seededClient();

    const { result } = renderHook(() => useDeleteSeries("series-1"), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate();

    await waitFor(() => expect(isInvalidated(client, CACHE_KEYS.detail)).toBe(true));
  });

  it("leaves publishers fresh after a favorite toggle", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeBookView()));
    const client = seededClient();

    const { result } = renderHook(() => useToggleFavorite(), { wrapper: makeWrapper(client) });
    result.current.mutate({ id: makeBookView().id, isFavorite: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(isInvalidated(client, CACHE_KEYS.detail)).toBe(false);
  });
});
