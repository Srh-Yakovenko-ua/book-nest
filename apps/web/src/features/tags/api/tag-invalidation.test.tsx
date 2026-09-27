import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBulkAddTags, useDeleteBook } from "@/features/books/api/use-book-actions";
import { useUpdateBook } from "@/features/books/api/use-update-book";
import { useSoftDeleteCharacter } from "@/features/characters/api/use-soft-delete-character";
import { useUpdateBookCharacter } from "@/features/characters/api/use-update-book-character";
import {
  makeCharacterDetails,
  makeDeletionResult,
} from "@/features/characters/model/characters.fixtures";
import { genresKeys } from "@/features/genres/api/genres-keys";

import { tagsKeys } from "./tags-keys";
import { useCreateTag } from "./use-create-tag";
import { useDeleteTag } from "./use-delete-tag";
import { useUpdateTag } from "./use-update-tag";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";
const TAG_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const TAG_KEYS = {
  catalog: tagsKeys.catalog({ filter: "all", sort: "usage_count_desc" }),
  facets: tagsKeys.facets({}),
  picker: tagsKeys.picker(""),
  summary: tagsKeys.summary,
} as const;

const INVALIDATED = {
  aggregatesOnly: { catalog: true, facets: true, picker: false, summary: true },
  everything: { catalog: true, facets: true, picker: true, summary: true },
  nothing: { catalog: false, facets: false, picker: false, summary: false },
} as const;

const GENRE_KEYS = [
  genresKeys.facets({}),
  genresKeys.overview,
  genresKeys.stats({ filter: "all", sort: "books_count_desc" }),
  genresKeys.summary,
] as const;

const CREATED_TAG = {
  color: "parchment",
  createdAt: "2026-09-23T10:00:00.000Z",
  description: null,
  id: TAG_ID,
  lastUsedAt: null,
  name: "found family",
  normalizedName: "found family",
  type: "custom",
  updatedAt: "2026-09-23T10:00:00.000Z",
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("relationship mutations refresh the Tags page but not the picker", () => {
  it("refreshes catalog, facets and summary after deleting a book", async () => {
    replyWith({});
    const client = seededClient();
    const { result } = renderHook(() => useDeleteBook(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync(BOOK_ID));

    expect(tagInvalidation(client)).toEqual(INVALIDATED.aggregatesOnly);
  });

  it("refreshes catalog, facets and summary after re-tagging a character", async () => {
    replyWith(makeCharacterDetails({ id: CHARACTER_ID }));
    const client = seededClient();
    const { result } = renderHook(() => useUpdateBookCharacter(), {
      wrapper: wrapperFor(client),
    });

    await act(() =>
      result.current.mutateAsync({
        bookId: BOOK_ID,
        characterId: CHARACTER_ID,
        input: { tagIds: [TAG_ID] },
      }),
    );

    expect(tagInvalidation(client)).toEqual(INVALIDATED.aggregatesOnly);
  });

  it("refreshes catalog, facets and summary after soft-deleting a character", async () => {
    replyWith(makeDeletionResult({ characterId: CHARACTER_ID }));
    const client = seededClient();
    const { result } = renderHook(() => useSoftDeleteCharacter(), {
      wrapper: wrapperFor(client),
    });

    await act(() => result.current.mutateAsync(CHARACTER_ID));

    expect(tagInvalidation(client)).toEqual(INVALIDATED.aggregatesOnly);
  });
});

describe("book tagging by name can create tags, so the picker refreshes too", () => {
  it("refreshes aggregates and the picker after a bulk tag assignment", async () => {
    replyWith({ affected: 2 });
    const client = seededClient();
    const { result } = renderHook(() => useBulkAddTags(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ bookIds: [BOOK_ID], tags: ["found family"] }));

    expect(tagInvalidation(client)).toEqual(INVALIDATED.everything);
  });

  it("refreshes aggregates and the picker after a book edit", async () => {
    replyWith({});
    const client = seededClient();
    const { result } = renderHook(() => useUpdateBook(BOOK_ID), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ tags: ["found family"] }));

    expect(tagInvalidation(client)).toEqual(INVALIDATED.everything);
  });
});

describe("book edits without tags leave the Tags page alone", () => {
  it("does not refresh tag aggregates or the picker after a tagless book edit", async () => {
    replyWith({});
    const client = seededClient();
    const { result } = renderHook(() => useUpdateBook(BOOK_ID), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ title: "Renamed" }));

    expect(tagInvalidation(client)).toEqual(INVALIDATED.nothing);
  });
});

describe("Tag metadata mutations", () => {
  it("refresh the picker and aggregates but never Genres after a create", async () => {
    replyWith(CREATED_TAG, 201);
    const client = seededClient();
    const { result } = renderHook(() => useCreateTag(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({ color: "parchment", name: "found family", type: "custom" }),
    );

    expect(tagInvalidation(client)).toEqual(INVALIDATED.everything);
    expect(genreInvalidation(client)).toEqual([false, false, false, false]);
  });

  it("refresh the picker and aggregates but never Genres after a rename", async () => {
    replyWith(CREATED_TAG);
    const client = seededClient();
    const { result } = renderHook(() => useUpdateTag(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ id: TAG_ID, input: { name: "found family" } }));

    expect(tagInvalidation(client)).toEqual(INVALIDATED.everything);
    expect(genreInvalidation(client)).toEqual([false, false, false, false]);
  });

  it("refresh the picker and aggregates but never Genres after a delete", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = seededClient();
    const { result } = renderHook(() => useDeleteTag(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync(TAG_ID));

    expect(tagInvalidation(client)).toEqual(INVALIDATED.everything);
    expect(genreInvalidation(client)).toEqual([false, false, false, false]);
  });
});

function genreInvalidation(client: QueryClient): boolean[] {
  return GENRE_KEYS.map((key) => isInvalidated(client, key));
}

function isInvalidated(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}

function replyWith(body: unknown, status = 200) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status,
      }),
    ),
  );
}

function seededClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const key of [...Object.values(TAG_KEYS), ...GENRE_KEYS]) client.setQueryData(key, {});
  return client;
}

function tagInvalidation(client: QueryClient) {
  return {
    catalog: isInvalidated(client, TAG_KEYS.catalog),
    facets: isInvalidated(client, TAG_KEYS.facets),
    picker: isInvalidated(client, TAG_KEYS.picker),
    summary: isInvalidated(client, TAG_KEYS.summary),
  };
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
