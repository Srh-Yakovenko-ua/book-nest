import type { ReactNode } from "react";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import type { RelationshipScope } from "../model/relationship-scope";

import { makeRelationshipPage, RELATIONSHIP_FIXTURE } from "../model/relationships.fixtures";
import { useRelationshipList } from "./use-relationship-list";

type ScopeCase = {
  expected: Record<string, string>;
  name: string;
  scope: RelationshipScope;
};

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const CHARACTER_ID = RELATIONSHIP_FIXTURE.geralt.id;
const SERIES_ID = "5a5a5a5a-0000-4000-8000-000000000003";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function lastRequest(): URL {
  const call = fetchMock.mock.calls.at(-1);
  if (call === undefined) throw new Error("no relationship list request");
  return new URL(String(call[0]), "http://localhost");
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makeRelationshipPage([]))));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useRelationshipList scope params", () => {
  it.each<ScopeCase>([
    {
      expected: { scope: "book", scopeId: BOOK_ID },
      name: "a book list by the book alone, never with a context book",
      scope: { bookId: BOOK_ID, kind: "book" },
    },
    {
      expected: { scope: "character", scopeId: CHARACTER_ID },
      name: "the global character list without any context book",
      scope: { characterId: CHARACTER_ID, contextBookId: null, kind: "character" },
    },
    {
      expected: { contextBookId: BOOK_ID, scope: "character", scopeId: CHARACTER_ID },
      name: "a character inside a book with that context book",
      scope: { characterId: CHARACTER_ID, contextBookId: BOOK_ID, kind: "character" },
    },
    {
      expected: { contextBookId: BOOK_ID, scope: "series", scopeId: SERIES_ID },
      name: "a series list with its context book",
      scope: { contextBookId: BOOK_ID, kind: "series", seriesId: SERIES_ID },
    },
    {
      expected: { scope: "series", scopeId: SERIES_ID },
      name: "a series list without a context book while the server picks the default",
      scope: { contextBookId: null, kind: "series", seriesId: SERIES_ID },
    },
  ])("requests $name", async ({ expected, scope }) => {
    renderHook(() => useRelationshipList({ criteria: { sort: "name_asc" }, scope }), {
      wrapper: makeWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(lastRequest().pathname).toBe("/api/character-relationships");
    expect(Object.fromEntries(lastRequest().searchParams)).toEqual({
      ...expected,
      pageNumber: "1",
      pageSize: "20",
      sort: "name_asc",
    });
  });
});

describe("useRelationshipList criteria params", () => {
  it("repeats every selected category and type as its own query value", async () => {
    renderHook(
      () =>
        useRelationshipList({
          criteria: {
            categories: ["family", "romantic"],
            relationshipTypes: ["guardian_of", "spouse_of"],
            sort: "newest",
          },
          scope: { bookId: BOOK_ID, kind: "book" },
        }),
      { wrapper: makeWrapper(createTestQueryClient()) },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(lastRequest().searchParams.getAll("categories")).toEqual(["family", "romantic"]);
    expect(lastRequest().searchParams.getAll("relationshipTypes")).toEqual([
      "guardian_of",
      "spouse_of",
    ]);
    expect(lastRequest().searchParams.get("sort")).toBe("newest");
  });
});
