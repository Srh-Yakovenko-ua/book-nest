import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookReadingControllerGetReadingHistoryParams } from "@/shared/api/generated/model/bookReadingControllerGetReadingHistoryParams";

import { createTestQueryClient } from "@/test-utils";

import { makeBookView } from "../components/book-details.fixtures";
import { makeReadingHistoryView } from "../components/reading-history.fixtures";
import { useBookMutationSync } from "./use-book-mutation-sync";
import { useReadingHistory } from "./use-reading-history";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEFAULT_PARAMS: BookReadingControllerGetReadingHistoryParams = {
  activityRange: "7d",
  limit: 3,
  page: 1,
  sort: "desc",
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function historyRequests() {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/reading-history"));
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

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/reading-history")) {
      return Promise.resolve(jsonResponse(makeReadingHistoryView()));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useReadingHistory", () => {
  it("parses and returns the reading-history response", async () => {
    const { result } = renderHook(() => useReadingHistory(BOOK_ID, DEFAULT_PARAMS), {
      wrapper: makeWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.summary.currentPage).toBe(250);
  });

  it("sends the range, page, sort and limit params in the request", async () => {
    renderHook(
      () => useReadingHistory(BOOK_ID, { activityRange: "14d", limit: 20, page: 2, sort: "asc" }),
      { wrapper: makeWrapper(createTestQueryClient()) },
    );

    await waitFor(() => expect(historyRequests().length).toBeGreaterThan(0));
    const [firstInput] = historyRequests()[0] ?? [];
    const url = new URL(String(firstInput), "http://localhost");
    expect(url.pathname).toContain(BOOK_ID);
    expect(url.searchParams.get("activityRange")).toBe("14d");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("sort")).toBe("asc");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("does not fetch while disabled", async () => {
    const { result } = renderHook(
      () => useReadingHistory(BOOK_ID, DEFAULT_PARAMS, { enabled: false }),
      { wrapper: makeWrapper(createTestQueryClient()) },
    );

    await Promise.resolve();
    expect(historyRequests()).toHaveLength(0);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("surfaces an error when the response fails validation", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ unexpected: true })));

    const { result } = renderHook(() => useReadingHistory(BOOK_ID, DEFAULT_PARAMS), {
      wrapper: makeWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("refetches the reading history after a book mutation sync invalidates it", async () => {
    const client = createTestQueryClient();
    const wrapper = makeWrapper(client);

    const { result: historyResult } = renderHook(() => useReadingHistory(BOOK_ID, DEFAULT_PARAMS), {
      wrapper,
    });
    await waitFor(() => expect(historyResult.current.isSuccess).toBe(true));

    const requestsBefore = historyRequests().length;

    const { result: syncResult } = renderHook(() => useBookMutationSync(), { wrapper });
    act(() => {
      syncResult.current(makeBookView({ id: BOOK_ID }));
    });

    await waitFor(() => expect(historyRequests().length).toBeGreaterThan(requestsBefore));
  });
});
