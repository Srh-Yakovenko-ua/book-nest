import type { ReactNode } from "react";

import { CHARACTER_FACT_ERROR_CODES } from "@app/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeCharacterFact } from "../model/characters.fixtures";
import { characterKeys } from "./character-keys";
import { useCreateCharacterFact } from "./use-create-character-fact";
import { useDeleteCharacterFact } from "./use-delete-character-fact";
import { useUpdateCharacterFact } from "./use-update-character-fact";

const BOOK_ID = "book-1";
const OTHER_BOOK_ID = "book-2";
const CHARACTER_ID = "char-1";
const OTHER_CHARACTER_ID = "char-2";

const SCOPE = { bookId: BOOK_ID, characterId: CHARACTER_ID } as const;

const SEEDED_KEYS = {
  details: characterKeys.details(CHARACTER_ID, { contextBookId: BOOK_ID }),
  facts: characterKeys.factsInfinite({ ...SCOPE, q: "" }),
  otherBookFacts: characterKeys.factsInfinite({
    bookId: OTHER_BOOK_ID,
    characterId: CHARACTER_ID,
    q: "",
  }),
  otherCharacterDetails: characterKeys.details(OTHER_CHARACTER_ID, { contextBookId: BOOK_ID }),
  otherCharacterFacts: characterKeys.factsInfinite({
    bookId: BOOK_ID,
    characterId: OTHER_CHARACTER_ID,
    q: "",
  }),
  otherCharacterPreview: characterKeys.deletionPreview(OTHER_CHARACTER_ID),
  preview: characterKeys.deletionPreview(CHARACTER_ID),
  searchedFacts: characterKeys.factsInfinite({ ...SCOPE, q: "меч" }),
} as const;

const EXPECTED = {
  factsAndDetailsRefreshed: {
    details: true,
    facts: true,
    otherBookFacts: false,
    otherCharacterDetails: false,
    otherCharacterFacts: false,
    otherCharacterPreview: false,
    preview: true,
    searchedFacts: true,
  },
  factsRefreshed: {
    details: false,
    facts: true,
    otherBookFacts: false,
    otherCharacterDetails: false,
    otherCharacterFacts: false,
    otherCharacterPreview: false,
    preview: true,
    searchedFacts: true,
  },
  nothingRefreshed: {
    details: false,
    facts: false,
    otherBookFacts: false,
    otherCharacterDetails: false,
    otherCharacterFacts: false,
    otherCharacterPreview: false,
    preview: false,
    searchedFacts: false,
  },
} as const;

const NEW_FACT_INPUT = { chapter: null, page: 12, text: "Має кобилу Плотву.", title: "Плотва" };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("character fact mutations refresh only the facts they changed", () => {
  it("refreshes the facts of that character in that book after a fact is created", async () => {
    replyWith(201, makeCharacterFact());
    const client = seededClient();
    const { result } = renderHook(() => useCreateCharacterFact(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ ...SCOPE, input: NEW_FACT_INPUT }));

    expect(invalidation(client)).toEqual(EXPECTED.factsRefreshed);
  });

  it("refreshes the facts of that character in that book after a fact is updated", async () => {
    replyWith(200, makeCharacterFact({ title: "Плотва" }));
    const client = seededClient();
    const { result } = renderHook(() => useUpdateCharacterFact(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({ ...SCOPE, factId: "fact-1", input: { title: "Плотва" } }),
    );

    expect(invalidation(client)).toEqual(EXPECTED.factsRefreshed);
  });

  it("refreshes the facts of that character in that book after a fact is deleted", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = seededClient();
    const { result } = renderHook(() => useDeleteCharacterFact(), { wrapper: wrapperFor(client) });

    await act(() => result.current.mutateAsync({ ...SCOPE, factId: "fact-1" }));

    expect(invalidation(client)).toEqual(EXPECTED.factsRefreshed);
  });
});

describe("character fact mutations that find their target gone", () => {
  it("also refreshes the character details when a create finds the character gone", async () => {
    replyWith(404, { message: "Character is not in this book" });
    const client = seededClient();
    const { result } = renderHook(() => useCreateCharacterFact(), { wrapper: wrapperFor(client) });

    await act(() =>
      expect(result.current.mutateAsync({ ...SCOPE, input: NEW_FACT_INPUT })).rejects.toThrow(),
    );

    expect(invalidation(client)).toEqual(EXPECTED.factsAndDetailsRefreshed);
  });

  it("also refreshes the character details when an update finds the fact gone", async () => {
    replyWith(404, { code: CHARACTER_FACT_ERROR_CODES.notFound, message: "Fact not found" });
    const client = seededClient();
    const { result } = renderHook(() => useUpdateCharacterFact(), { wrapper: wrapperFor(client) });

    await act(() =>
      expect(
        result.current.mutateAsync({ ...SCOPE, factId: "fact-1", input: { title: "Плотва" } }),
      ).rejects.toThrow(),
    );

    expect(invalidation(client)).toEqual(EXPECTED.factsAndDetailsRefreshed);
  });

  it("also refreshes the character details when a delete finds the fact gone", async () => {
    replyWith(404, { code: CHARACTER_FACT_ERROR_CODES.notFound, message: "Fact not found" });
    const client = seededClient();
    const { result } = renderHook(() => useDeleteCharacterFact(), { wrapper: wrapperFor(client) });

    await act(() =>
      expect(result.current.mutateAsync({ ...SCOPE, factId: "fact-1" })).rejects.toThrow(),
    );

    expect(invalidation(client)).toEqual(EXPECTED.factsAndDetailsRefreshed);
  });

  it("refreshes nothing when a delete fails for any other reason", async () => {
    replyWith(500, { message: "boom" });
    const client = seededClient();
    const { result } = renderHook(() => useDeleteCharacterFact(), { wrapper: wrapperFor(client) });

    await act(() =>
      expect(result.current.mutateAsync({ ...SCOPE, factId: "fact-1" })).rejects.toThrow(),
    );

    expect(invalidation(client)).toEqual(EXPECTED.nothingRefreshed);
  });
});

function invalidation(client: QueryClient): Record<keyof typeof SEEDED_KEYS, boolean> {
  return {
    details: isInvalidated(client, SEEDED_KEYS.details),
    facts: isInvalidated(client, SEEDED_KEYS.facts),
    otherBookFacts: isInvalidated(client, SEEDED_KEYS.otherBookFacts),
    otherCharacterDetails: isInvalidated(client, SEEDED_KEYS.otherCharacterDetails),
    otherCharacterFacts: isInvalidated(client, SEEDED_KEYS.otherCharacterFacts),
    otherCharacterPreview: isInvalidated(client, SEEDED_KEYS.otherCharacterPreview),
    preview: isInvalidated(client, SEEDED_KEYS.preview),
    searchedFacts: isInvalidated(client, SEEDED_KEYS.searchedFacts),
  };
}

function isInvalidated(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}

function replyWith(status: number, body: unknown) {
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
  for (const key of Object.values(SEEDED_KEYS)) client.setQueryData(key, {});
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
