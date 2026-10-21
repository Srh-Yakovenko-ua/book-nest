import type {
  CharacterRelationshipCustomTypeView,
  Nullable,
  RelationshipDirectionality,
} from "@app/shared";
import type { ReactNode } from "react";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import type { RelationshipCustomTypeSuggestionsState } from "./use-relationship-custom-type-suggestions";

import { useRelationshipCustomTypeSuggestions } from "./use-relationship-custom-type-suggestions";

type SuggestionProps = {
  directionality: Nullable<RelationshipDirectionality>;
  enabled: boolean;
  search: string;
};

const SAVED_TYPES: CharacterRelationshipCustomTypeView[] = Array.from(
  { length: 45 },
  (_, index) => ({
    directionality: index % 2 === 0 ? "symmetric" : "directed",
    id: `custom-type-${index + 1}`,
    name: `Власний тип ${index + 1}`,
  }),
);
const BROWSE: SuggestionProps = { directionality: null, enabled: true, search: "" };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function failure(): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify({ message: "boom" }), { status: 500 }));
}

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

function lastRequest(): URL {
  const request = suggestionRequests().at(-1);
  if (request === undefined) throw new Error("no custom type request");
  return request;
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function renderSuggestions(props: Partial<SuggestionProps> = {}) {
  return renderHook((current: SuggestionProps) => useRelationshipCustomTypeSuggestions(current), {
    initialProps: { ...BROWSE, ...props },
    wrapper: makeWrapper(createTestQueryClient()),
  });
}

function savedTypesPage(request: URL) {
  const pageNumber = Number(request.searchParams.get("pageNumber"));
  const pageSize = Number(request.searchParams.get("pageSize"));
  return {
    items: SAVED_TYPES.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    page: pageNumber,
    pagesCount: Math.ceil(SAVED_TYPES.length / pageSize),
    pageSize,
    totalCount: SAVED_TYPES.length,
  };
}

function searchTerms(): string[] {
  return suggestionRequests().flatMap((request) => {
    const term = request.searchParams.get("q");
    return term === null ? [] : [term];
  });
}

function serveSavedTypes(respond: (request: URL) => Promise<Response>) {
  fetchMock.mockImplementation((input) => respond(new URL(String(input), "http://localhost")));
}

function suggestedNames(state: RelationshipCustomTypeSuggestionsState): string[] {
  return state.kind === "results" ? state.items.map((item) => item.name) : [];
}

function suggestionRequests(): URL[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
}

beforeEach(() => {
  fetchMock.mockReset();
  serveSavedTypes((request) => json(savedTypesPage(request)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useRelationshipCustomTypeSuggestions browse", () => {
  it("§3.3 T15 browses the latest 20 saved custom types when the field is empty", async () => {
    renderSuggestions();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(lastRequest().pathname).toBe("/api/character-relationship-custom-types");
    expect(Object.fromEntries(lastRequest().searchParams)).toEqual({
      pageNumber: "1",
      pageSize: "20",
    });
  });

  it("T05 grows the list 20, 40, 45 in a stable order as the user scrolls", async () => {
    const { result } = renderSuggestions();
    await waitFor(() => expect(suggestedNames(result.current.state)).toHaveLength(20));

    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(suggestedNames(result.current.state)).toHaveLength(40));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(suggestedNames(result.current.state)).toHaveLength(45));

    expect(suggestedNames(result.current.state)).toEqual(SAVED_TYPES.map((item) => item.name));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("T05 reports the next page as loading while it is on its way", async () => {
    serveSavedTypes((request) =>
      request.searchParams.get("pageNumber") === "2"
        ? new Promise<Response>(() => undefined)
        : json(savedTypesPage(request)),
    );
    const { result } = renderSuggestions();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
  });
});

describe("useRelationshipCustomTypeSuggestions search", () => {
  it("T15 shows a hint for a one-character name and sends no request", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { result } = renderSuggestions({ search: " б " });

    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(result.current.state).toEqual({ kind: "hint" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("T15 sends no request when the list opens with a one-character name already typed", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { rerender } = renderSuggestions({ enabled: false });

    rerender({ ...BROWSE, search: "б" });
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("T04 searches the dictionary by the trimmed term only once 300 ms have passed", async () => {
    const { rerender } = renderSuggestions();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    rerender({ ...BROWSE, search: "  побр  " });
    await act(() => vi.advanceTimersByTimeAsync(299));

    expect(searchTerms()).toEqual([]);

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(searchTerms()).toEqual(["побр"]);
  });
});

describe("useRelationshipCustomTypeSuggestions failures", () => {
  it("T15 turns a failed suggestions request into an error state without throwing", async () => {
    serveSavedTypes(failure);
    const { result } = renderSuggestions();

    await waitFor(() => expect(result.current.state).toEqual({ kind: "error" }));
  });

  it("T05 keeps the loaded suggestions and flags the failed next page", async () => {
    serveSavedTypes((request) =>
      request.searchParams.get("pageNumber") === "2" ? failure() : json(savedTypesPage(request)),
    );
    const { result } = renderSuggestions();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));
    expect(suggestedNames(result.current.state)).toHaveLength(20);
  });

  it("T05 loads the failed next page on retry", async () => {
    let secondPageAttempts = 0;
    serveSavedTypes((request) => {
      if (request.searchParams.get("pageNumber") !== "2") return json(savedTypesPage(request));
      secondPageAttempts += 1;
      return secondPageAttempts === 1 ? failure() : json(savedTypesPage(request));
    });
    const { result } = renderSuggestions();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));

    act(() => result.current.retry());

    await waitFor(() => expect(suggestedNames(result.current.state)).toHaveLength(40));
  });
});
