import type { ReactNode } from "react";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import type { RelationshipReveal } from "../model/relationship-reveal";
import type { RelationshipScope } from "../model/relationship-scope";

import { makeRelationshipDetails, RELATIONSHIP_FIXTURE } from "../model/relationships.fixtures";
import { useRelationshipDetails } from "./use-relationship-details";

type ScopeCase = {
  expected: Record<string, string>;
  name: string;
  scope: RelationshipScope;
};

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const CHARACTER_ID = RELATIONSHIP_FIXTURE.geralt.id;
const SERIES_ID = "5a5a5a5a-0000-4000-8000-000000000003";

const BOOK_SCOPE: RelationshipScope = { bookId: BOOK_ID, kind: "book" };

const NO_REVEAL: RelationshipReveal = { descriptionBookStateId: null, isTypeRevealed: false };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let detailsBody: unknown;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function lastRequest(): URL {
  const call = fetchMock.mock.calls.at(-1);
  if (call === undefined) throw new Error("no relationship details request");
  return new URL(String(call[0]), "http://localhost");
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function renderDetails({
  reveal = NO_REVEAL,
  scope = BOOK_SCOPE,
}: {
  reveal?: RelationshipReveal;
  scope?: RelationshipScope;
}) {
  return renderHook(
    () =>
      useRelationshipDetails({
        relationshipId: RELATIONSHIP_FIXTURE.relationshipId,
        reveal,
        scope,
      }),
    { wrapper: makeWrapper(createTestQueryClient()) },
  );
}

beforeEach(() => {
  detailsBody = makeRelationshipDetails();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(detailsBody)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useRelationshipDetails scope params", () => {
  it.each<ScopeCase>([
    {
      expected: { scope: "book", scopeId: BOOK_ID },
      name: "a book scope without a context book",
      scope: BOOK_SCOPE,
    },
    {
      expected: { scope: "character", scopeId: CHARACTER_ID },
      name: "the global character scope without a context book",
      scope: { characterId: CHARACTER_ID, contextBookId: null, kind: "character" },
    },
    {
      expected: { contextBookId: BOOK_ID, scope: "character", scopeId: CHARACTER_ID },
      name: "a character inside a book with that context book",
      scope: { characterId: CHARACTER_ID, contextBookId: BOOK_ID, kind: "character" },
    },
    {
      expected: { contextBookId: BOOK_ID, scope: "series", scopeId: SERIES_ID },
      name: "a series scope with its context book",
      scope: { contextBookId: BOOK_ID, kind: "series", seriesId: SERIES_ID },
    },
  ])("asks for the masked details in $name", async ({ expected, scope }) => {
    renderDetails({ scope });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(lastRequest().pathname).toBe(
      `/api/character-relationships/${RELATIONSHIP_FIXTURE.relationshipId}`,
    );
    expect(Object.fromEntries(lastRequest().searchParams)).toEqual(expected);
  });
});

describe("useRelationshipDetails reveal params", () => {
  it("adds a type reveal and one description reveal to the same scope", async () => {
    renderDetails({ reveal: { descriptionBookStateId: "state-2", isTypeRevealed: true } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(Object.fromEntries(lastRequest().searchParams)).toEqual({
      revealDescriptionBookStateId: "state-2",
      revealType: "true",
      scope: "book",
      scopeId: BOOK_ID,
    });
  });
});

describe("useRelationshipDetails response", () => {
  it("keeps only the fields of the safe details contract", async () => {
    detailsBody = {
      ...makeRelationshipDetails(),
      bookStates: [{ description: "Цірі — Дитя Старшої Крові.", id: "state-9" }],
      diagnostics: [],
    };

    const { result } = renderDetails({});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(makeRelationshipDetails());
  });
});
