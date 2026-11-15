import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { genresKeys } from "@/features/genres/api/genres-keys";
import { createTestQueryClient } from "@/test-utils";

import { useDeliverySync, useDeliverySyncAwaitingInTransitList } from "./delivery-cache";
import { useInTransitList } from "./use-in-transit-list";

const GENRE_DERIVED_KEYS = [
  genresKeys.stats({ filter: "all", sort: "books_count_desc" }),
  genresKeys.facets({}),
  genresKeys.summary,
  genresKeys.overview,
] as const;

const UNRELATED_KEY = ["/api/notes", "x"] as const;

const OWNERSHIP_DERIVED_KEYS = [
  ["/api/statistics", "overview", { period: "year" }],
  ["/api/goals", "overview"],
  ["/api/lists", "detail", "list-1"],
  ["/api/publishers", "summary", "uk"],
  ["/api/reading-queue"],
] as const;

const IN_TRANSIT_LIST_PATH = "/api/delivery/books/in-transit";

const EMPTY_IN_TRANSIT_PAGE = { items: [], page: 1, pagesCount: 0, pageSize: 24, totalCount: 0 };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

describe("useDeliverySync", () => {
  it("refreshes Genre analytics because deliveries change ownership status", () => {
    const client = new QueryClient();
    for (const key of [...GENRE_DERIVED_KEYS, UNRELATED_KEY]) client.setQueryData(key, {});
    const { result } = renderHook(() => useDeliverySync(), { wrapper: wrapperFor(client) });

    act(() => result.current());

    expect(GENRE_DERIVED_KEYS.map((key) => isInvalidated(client, key))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isInvalidated(client, UNRELATED_KEY)).toBe(false);
  });

  it("refreshes statistics, goals, lists, publishers and the queue that ownership feeds", () => {
    const client = new QueryClient();
    for (const key of OWNERSHIP_DERIVED_KEYS) client.setQueryData(key, {});
    const { result } = renderHook(() => useDeliverySync(), { wrapper: wrapperFor(client) });

    act(() => result.current());

    expect(OWNERSHIP_DERIVED_KEYS.map((key) => isInvalidated(client, key))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});

describe("useDeliverySyncAwaitingInTransitList", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) =>
      requestPath(input) === IN_TRANSIT_LIST_PATH
        ? Promise.resolve(jsonResponse(EMPTY_IN_TRANSIT_PAGE))
        : Promise.reject(new Error(`unexpected fetch: ${String(input)}`)),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the open in-transit list exactly once per sync", async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => ({
        list: useInTransitList({ pageSize: 24 }),
        sync: useDeliverySyncAwaitingInTransitList(),
      }),
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    fetchMock.mockClear();

    await act(() => result.current.sync());

    expect(fetchMock.mock.calls.map(([input]) => requestPath(input))).toEqual([
      IN_TRANSIT_LIST_PATH,
    ]);
  });
});

function isInvalidated(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function requestPath(input: RequestInfo | URL): string {
  return new URL(String(input), "http://localhost").pathname;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
