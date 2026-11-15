import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookDetailsView, makeBookView } from "../components/book-details.fixtures";
import { bookKeys } from "./book-keys";
import { useBook } from "./use-book";
import { useDeleteBook, useToggleFavorite } from "./use-book-actions";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOOK_PATH = `/api/books/${BOOK_ID}`;
const BOOK_TITLE = "The Last Wish";

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

describe("useDeleteBook from the book's own detail page", () => {
  it("does not request the deleted book again", async () => {
    const { result } = await openBookThenDeleteIt();

    await waitFor(() => expect(result.current.book.isFetching).toBe(false));
    expect(bookDetailRequestCount()).toBe(1);
  });

  it("keeps showing the book it just deleted", async () => {
    const { result } = await openBookThenDeleteIt();

    expect(result.current.book.data).toMatchObject({ id: BOOK_ID, title: BOOK_TITLE });
  });
});

function bookDetailRequestCount(): number {
  return fetchMock.mock.calls.filter(
    ([input, init]) => String(input).includes(BOOK_PATH) && (init?.method ?? "GET") === "GET",
  ).length;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

async function openBookThenDeleteIt() {
  let isDeleted = false;
  fetchMock.mockImplementation((input, init) => {
    if (!String(input).includes(BOOK_PATH)) {
      return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
    }
    if (init?.method === "DELETE") {
      isDeleted = true;
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (isDeleted) {
      return Promise.resolve(
        new Response(JSON.stringify({ message: "Book not found" }), { status: 404 }),
      );
    }
    return Promise.resolve(jsonResponse(makeBookDetailsView({ id: BOOK_ID, title: BOOK_TITLE })));
  });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = renderHook(() => ({ book: useBook(BOOK_ID), deleteBook: useDeleteBook() }), {
    wrapper: wrapperFor(client),
  });
  await waitFor(() => expect(view.result.current.book.isSuccess).toBe(true));

  await act(() => view.result.current.deleteBook.mutateAsync(BOOK_ID));
  await waitFor(() => expect(view.result.current.deleteBook.isSuccess).toBe(true));

  return view;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
