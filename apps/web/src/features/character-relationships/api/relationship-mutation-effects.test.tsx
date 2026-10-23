import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toRelationshipScopeKey } from "../model/relationship-scope";
import { makeEditableRelationship, RELATIONSHIP_FIXTURE } from "../model/relationships.fixtures";
import { relationshipKeys } from "./relationship-keys";
import { resetRelationshipReaderViews } from "./relationship-mutation-effects";
import { useCreateRelationship } from "./use-create-relationship";
import { useUpdateRelationship } from "./use-update-relationship";

type CacheEntryState = "cleared" | "invalidated" | "untouched";

type SavedRelationshipRoute = { method: "PATCH" | "POST"; path: string; status: number };

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;

const SEEDED_KEYS = {
  customTypes: relationshipKeys.customTypes({ directionality: "directed", term: "побр" }),
  list: relationshipKeys.list({
    criteria: { sort: "name_asc" },
    scopeKey: toRelationshipScopeKey({ bookId: BOOK_ID, kind: "book" }),
  }),
  roleSuggestions: relationshipKeys.roleSuggestions("наставник"),
  roster: relationshipKeys.roster({ bookId: BOOK_ID, sort: "name", term: "" }),
} as const;

const AFTER_SAVE = {
  customTypes: "cleared",
  list: "invalidated",
  roleSuggestions: "cleared",
  roster: "untouched",
} as const satisfies Record<keyof typeof SEEDED_KEYS, CacheEntryState>;

const AFTER_READER_RESET = {
  customTypes: "untouched",
  list: "cleared",
  roleSuggestions: "untouched",
  roster: "untouched",
} as const satisfies Record<keyof typeof SEEDED_KEYS, CacheEntryState>;

const SAVE_ROUTES = {
  create: { method: "POST", path: "/api/character-relationships", status: 201 },
  update: {
    method: "PATCH",
    path: `/api/character-relationships/${RELATIONSHIP_FIXTURE.relationshipId}`,
    status: 200,
  },
} as const satisfies Record<string, SavedRelationshipRoute>;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function cacheEntryState(client: QueryClient, queryKey: readonly unknown[]): CacheEntryState {
  const state = client.getQueryState(queryKey);
  if (state?.data === undefined) return "cleared";
  return state.isInvalidated ? "invalidated" : "untouched";
}

function cacheStates(client: QueryClient): Record<keyof typeof SEEDED_KEYS, CacheEntryState> {
  return {
    customTypes: cacheEntryState(client, SEEDED_KEYS.customTypes),
    list: cacheEntryState(client, SEEDED_KEYS.list),
    roleSuggestions: cacheEntryState(client, SEEDED_KEYS.roleSuggestions),
    roster: cacheEntryState(client, SEEDED_KEYS.roster),
  };
}

function seededClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const key of Object.values(SEEDED_KEYS)) client.setQueryData(key, {});
  return client;
}

function serveSavedRelationship({ method, path, status }: SavedRelationshipRoute) {
  fetchMock.mockImplementation((input, init) => {
    const pathname = new URL(String(input), "http://localhost").pathname;
    if (init?.method !== method || pathname !== path) {
      return Promise.reject(new Error(`unexpected fetch: ${init?.method ?? "GET"} ${pathname}`));
    }
    return Promise.resolve(
      new Response(JSON.stringify(makeEditableRelationship()), {
        headers: { "Content-Type": "application/json" },
        status,
      }),
    );
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("relationship saves refresh the suggestion dictionaries", () => {
  it("§11.3 E02 clears the custom type and role suggestions after a create and leaves the roster alone", async () => {
    serveSavedRelationship(SAVE_ROUTES.create);
    const client = seededClient();
    const { result } = renderHook(() => useCreateRelationship(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({
        allowFamilyCycle: false,
        category: "family",
        directionality: "directed",
        initialBookStates: [],
        isCanonical: false,
        sourceCharacterId: RELATIONSHIP_FIXTURE.geralt.id,
        targetCharacterId: RELATIONSHIP_FIXTURE.ciri.id,
        type: "guardian_of",
      }),
    );

    expect(cacheStates(client)).toEqual(AFTER_SAVE);
  });

  it("§11.3 E02 clears the custom type and role suggestions after an update and leaves the roster alone", async () => {
    serveSavedRelationship(SAVE_ROUTES.update);
    const client = seededClient();
    const { result } = renderHook(() => useUpdateRelationship(), { wrapper: wrapperFor(client) });

    await act(() =>
      result.current.mutateAsync({
        input: { allowFamilyCycle: false, sourceLabel: "наставник" },
        relationshipId: RELATIONSHIP_FIXTURE.relationshipId,
      }),
    );

    expect(cacheStates(client)).toEqual(AFTER_SAVE);
  });
});

describe("reading progress moving backwards", () => {
  it("drops the cached relationship views and keeps the views outside the relationship root", async () => {
    const client = seededClient();

    await resetRelationshipReaderViews(client);

    expect(cacheStates(client)).toEqual(AFTER_READER_RESET);
  });
});
