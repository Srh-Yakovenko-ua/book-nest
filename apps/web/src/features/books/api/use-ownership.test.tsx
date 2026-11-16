import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { wishlistKeys } from "@/features/books-to-buy/api/wishlist-keys";

import { bookKeys } from "./book-keys";
import { useMarkBought, useRemoveFromWishlist } from "./use-ownership";

type Failure = { body: object; status: number };

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const FAILURES = {
  generic: { body: { message: "Internal server error" }, status: 500 },
  notInWishlist: {
    body: { code: "NOT_IN_WISHLIST", message: "Book is not in the wishlist" },
    status: 409,
  },
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMarkBought", () => {
  it("refreshes the wishlist and the book when the book already left the wishlist", async () => {
    const client = await wishlistAfterFailedMarkBought(FAILURES.notInWishlist);

    expect(client.getQueryState(wishlistKeys.root)?.isInvalidated).toBe(true);
    expect(client.getQueryState(bookKeys.detail(BOOK_ID))?.isInvalidated).toBe(true);
  });

  it("leaves the wishlist fresh after a generic failure", async () => {
    const client = await wishlistAfterFailedMarkBought(FAILURES.generic);

    expect(client.getQueryState(wishlistKeys.root)?.isInvalidated).toBe(false);
  });
});

describe("useRemoveFromWishlist", () => {
  it("refreshes the wishlist and the book when the book already left the wishlist", async () => {
    const client = await wishlistAfterFailedRemoval(FAILURES.notInWishlist);

    expect(client.getQueryState(wishlistKeys.root)?.isInvalidated).toBe(true);
    expect(client.getQueryState(bookKeys.detail(BOOK_ID))?.isInvalidated).toBe(true);
  });

  it("leaves the wishlist fresh after a generic failure", async () => {
    const client = await wishlistAfterFailedRemoval(FAILURES.generic);

    expect(client.getQueryState(wishlistKeys.root)?.isInvalidated).toBe(false);
  });
});

async function wishlistAfterFailedMarkBought(failure: Failure): Promise<QueryClient> {
  const client = wishlistClientFailingWith(failure);
  const { result } = renderHook(() => useMarkBought(), { wrapper: wrapperFor(client) });

  await act(() => result.current.mutateAsync({ id: BOOK_ID, payload: {} }).catch(() => undefined));

  return client;
}

async function wishlistAfterFailedRemoval(failure: Failure): Promise<QueryClient> {
  const client = wishlistClientFailingWith(failure);
  const { result } = renderHook(() => useRemoveFromWishlist(), { wrapper: wrapperFor(client) });

  await act(() => result.current.mutateAsync(BOOK_ID).catch(() => undefined));

  return client;
}

function wishlistClientFailingWith({ body, status }: Failure): QueryClient {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(wishlistKeys.root, {});
  client.setQueryData(bookKeys.detail(BOOK_ID), {});
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
