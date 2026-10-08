import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bookKeys } from "@/features/books/api/book-keys";

import { makeCharacterDetails, makeDeletionResult } from "../model/characters.fixtures";
import { useRestoreCharacter } from "./use-restore-character";
import { useSoftDeleteCharacter } from "./use-soft-delete-character";
import { useUnlinkCharacter } from "./use-unlink-character";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_BOOK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";

const SEEDED_KEYS = {
  bookChapters: bookKeys.chapters(BOOK_ID),
  bookDetail: bookKeys.detail(BOOK_ID),
  otherBookChapters: bookKeys.chapters(OTHER_BOOK_ID),
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("character mutations refresh the chapter suggestions", () => {
  it("refreshes only the chapters of the book a character was removed from", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = seededClient();
    const { result } = renderHook(() => useUnlinkCharacter(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ bookId: BOOK_ID, characterId: CHARACTER_ID }));

    expect(invalidation(client)).toEqual({
      bookChapters: true,
      bookDetail: false,
      otherBookChapters: false,
    });
  });

  it("refreshes the chapters of every book after a character is deleted", async () => {
    replyWith(makeDeletionResult({ characterId: CHARACTER_ID }));
    const client = seededClient();
    const { result } = renderHook(() => useSoftDeleteCharacter(), {
      wrapper: wrapperFor(client),
    });

    await act(() => result.current.mutateAsync(CHARACTER_ID));

    expect(invalidation(client)).toEqual({
      bookChapters: true,
      bookDetail: false,
      otherBookChapters: true,
    });
  });

  it("refreshes the chapters of every book after a deleted character is restored", async () => {
    replyWith(makeCharacterDetails({ id: CHARACTER_ID }));
    const client = seededClient();
    const { result } = renderHook(() => useRestoreCharacter(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync(CHARACTER_ID));

    expect(invalidation(client)).toEqual({
      bookChapters: true,
      bookDetail: false,
      otherBookChapters: true,
    });
  });
});

function invalidation(client: QueryClient) {
  return {
    bookChapters: isInvalidated(client, SEEDED_KEYS.bookChapters),
    bookDetail: isInvalidated(client, SEEDED_KEYS.bookDetail),
    otherBookChapters: isInvalidated(client, SEEDED_KEYS.otherBookChapters),
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
