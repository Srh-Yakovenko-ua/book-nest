import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryClientWrapper } from "@/test-query-cache";
import { createTestQueryClient, waitFor } from "@/test-utils";

import { makeBookView } from "../components/book-details.fixtures";
import { LIBRARY_PAGE_SIZE, libraryListParams } from "../model/library-query";
import { useLibraryBooks } from "./use-books";

const PAGES_COUNT = 12;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function booksPage(page: number) {
  return {
    items: Array.from({ length: LIBRARY_PAGE_SIZE }, (_, index) =>
      makeBookView({ id: `page-${page}-book-${index + 1}` }),
    ),
    page,
    pagesCount: PAGES_COUNT,
    pageSize: LIBRARY_PAGE_SIZE,
    totalCount: PAGES_COUNT * LIBRARY_PAGE_SIZE,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/books") {
      return Promise.resolve(jsonResponse(booksPage(Number(url.searchParams.get("pageNumber")))));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useLibraryBooks", () => {
  it("keeps the first page loaded once the eleventh page arrives", async () => {
    const { result } = renderHook(() => useLibraryBooks(libraryListParams()), {
      wrapper: queryClientWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

    for (let nextPage = 2; nextPage <= 11; nextPage += 1) {
      await act(async () => {
        await result.current.fetchNextPage();
      });
    }

    await waitFor(() =>
      expect(result.current.data?.pages.map((page) => page.page)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      ]),
    );
    expect(result.current.data?.pages[0]?.items[0]?.id).toBe("page-1-book-1");
  });
});
