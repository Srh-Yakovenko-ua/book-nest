import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listKeys } from "@/features/lists/api/list-keys";
import { createTestQueryClient } from "@/test-utils";

import { useSetBookLists } from "./use-book-lists";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LIST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ lists: [] })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useSetBookLists", () => {
  it("invalidates the list detail the book was removed from", async () => {
    const client = createTestQueryClient();
    const detailKey = [...listKeys.detail(LIST_ID), { pageSize: 24 }];
    await client.fetchQuery({ queryFn: () => Promise.resolve({ books: [] }), queryKey: detailKey });

    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useSetBookLists(BOOK_ID), {
      wrapper: makeWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ listIds: [], newLists: [] });
    });

    await waitFor(() => expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true));
  });
});
