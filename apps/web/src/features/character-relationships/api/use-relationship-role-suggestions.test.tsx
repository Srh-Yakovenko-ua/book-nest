import type { CharacterRelationshipRoleSuggestionView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import type { RelationshipRoleSuggestions } from "./use-relationship-role-suggestions";

import { useRelationshipRoleSuggestions } from "./use-relationship-role-suggestions";

type SuggestionProps = {
  enabled: boolean;
  search: string;
};

const SAVED_ROLES: CharacterRelationshipRoleSuggestionView[] = Array.from(
  { length: 45 },
  (_, index) => ({
    id: `0b0e5a1c-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    label: `Роль ${index + 1}`,
  }),
);

const MENTOR_ROLES = {
  exact: { id: "6f1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e", label: "Наставник" },
  partial: { id: "7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", label: "Старший наставник" },
} as const satisfies Record<string, CharacterRelationshipRoleSuggestionView>;

const BROWSE: SuggestionProps = { enabled: true, search: "" };

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
  if (request === undefined) throw new Error("no role suggestion request");
  return request;
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function mentorPage(items: readonly CharacterRelationshipRoleSuggestionView[]) {
  return { items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length };
}

function renderSuggestions(props: Partial<SuggestionProps> = {}) {
  return renderHook((current: SuggestionProps) => useRelationshipRoleSuggestions(current), {
    initialProps: { ...BROWSE, ...props },
    wrapper: makeWrapper(createTestQueryClient()),
  });
}

function requestedPages(): Nullable<string>[] {
  return suggestionRequests().map((request) => request.searchParams.get("pageNumber"));
}

function savedRolesPage(request: URL) {
  const pageNumber = Number(request.searchParams.get("pageNumber"));
  const pageSize = Number(request.searchParams.get("pageSize"));
  const term = request.searchParams.get("q")?.toLowerCase();
  const matching =
    term === undefined
      ? SAVED_ROLES
      : SAVED_ROLES.filter((role) => role.label.toLowerCase().includes(term));
  return {
    items: matching.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    page: pageNumber,
    pagesCount: Math.ceil(matching.length / pageSize),
    pageSize,
    totalCount: matching.length,
  };
}

function searchTerms(): string[] {
  return suggestionRequests().flatMap((request) => {
    const term = request.searchParams.get("q");
    return term === null ? [] : [term];
  });
}

function serveRoles(respond: (request: URL) => Promise<Response>) {
  fetchMock.mockImplementation((input) => respond(new URL(String(input), "http://localhost")));
}

function suggestedLabels(state: RelationshipRoleSuggestions["state"]): string[] {
  return state.kind === "results" ? state.items.map((item) => item.label) : [];
}

function suggestionRequests(): URL[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
}

beforeEach(() => {
  fetchMock.mockReset();
  serveRoles((request) => json(savedRolesPage(request)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useRelationshipRoleSuggestions browse", () => {
  it("§7.1 E06 browses the latest 20 roles with no search term when the field is empty", async () => {
    renderSuggestions();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(lastRequest().pathname).toBe("/api/character-relationship-role-suggestions");
    expect(Object.fromEntries(lastRequest().searchParams)).toEqual({
      pageNumber: "1",
      pageSize: "20",
    });
  });

  it("§7.2 loads nothing until the suggestions list is opened", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { rerender } = renderSuggestions({ enabled: false });
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(fetchMock).not.toHaveBeenCalled();

    vi.useRealTimers();
    rerender(BROWSE);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it("E06 grows the list 20, 40, 45 with no gaps or repeats as the author scrolls", async () => {
    const { result } = renderSuggestions();
    await waitFor(() => expect(suggestedLabels(result.current.state)).toHaveLength(20));

    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(suggestedLabels(result.current.state)).toHaveLength(40));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(suggestedLabels(result.current.state)).toHaveLength(45));

    expect(suggestedLabels(result.current.state)).toEqual(SAVED_ROLES.map((role) => role.label));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("§11.3 E06 shows a role once when the next page repeats it after the order shifted", async () => {
    const shiftedSecondPage = {
      items: SAVED_ROLES.slice(19, 39),
      page: 2,
      pagesCount: 3,
      pageSize: 20,
      totalCount: 46,
    };
    serveRoles((request) =>
      request.searchParams.get("pageNumber") === "2"
        ? json(shiftedSecondPage)
        : json(savedRolesPage(request)),
    );
    const { result } = renderSuggestions();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    const uniqueLabels = SAVED_ROLES.slice(0, 39).map((role) => role.label);

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(suggestedLabels(result.current.state)).toEqual(uniqueLabels));
  });

  it("§7.2 reports an empty dictionary as empty rather than as results", async () => {
    serveRoles(() => json(mentorPage([])));
    const { result } = renderSuggestions();

    await waitFor(() => expect(result.current.state).toEqual({ kind: "empty" }));
  });
});

describe("useRelationshipRoleSuggestions search", () => {
  it("§7.2 shows a hint for a one-character role and sends no request", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { result } = renderSuggestions({ search: " н " });

    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(result.current.state).toEqual({ kind: "hint" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("§7.2 sends no request when the list opens with a one-character role already typed", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { rerender } = renderSuggestions({ enabled: false });

    rerender({ ...BROWSE, search: "н" });
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("§7.2 searches by the trimmed, collapsed term only once 300 ms have passed", async () => {
    const { rerender } = renderSuggestions();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    rerender({ ...BROWSE, search: "  старший   брат  " });
    await act(() => vi.advanceTimersByTimeAsync(299));

    expect(searchTerms()).toEqual([]);

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(searchTerms()).toEqual(["старший брат"]);
  });

  it("E07 finds a role from the last page by searching, without loading the pages before it", async () => {
    const { rerender, result } = renderSuggestions();
    await waitFor(() => expect(suggestedLabels(result.current.state)).toHaveLength(20));
    expect(suggestedLabels(result.current.state)).not.toContain("Роль 45");

    rerender({ ...BROWSE, search: "Роль 45" });

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        items: SAVED_ROLES.slice(44),
        kind: "results",
      }),
    );
    expect(requestedPages()).toEqual(["1", "1"]);
  });

  it("§11.3 keeps the previous rows only as stale, unpaginated rows while the new term loads", async () => {
    serveRoles((request) =>
      request.searchParams.has("q")
        ? new Promise<Response>(() => undefined)
        : json(savedRolesPage(request)),
    );
    const { rerender, result } = renderSuggestions();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    rerender({ ...BROWSE, search: "Роль 44" });
    await waitFor(() => expect(searchTerms()).toEqual(["Роль 44"]));

    expect(result.current.state).toEqual({
      isStale: true,
      items: SAVED_ROLES.slice(0, 20),
      kind: "results",
    });
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("useRelationshipRoleSuggestions exact match and free value", () => {
  it("E05 puts the saved role matching the term, whatever its case and spaces, first", async () => {
    serveRoles(() => json(mentorPage([MENTOR_ROLES.partial, MENTOR_ROLES.exact])));
    const { result } = renderSuggestions({ search: "  НАСТАВНИК  " });

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        items: [MENTOR_ROLES.exact, MENTOR_ROLES.partial],
        kind: "results",
      }),
    );
    expect(result.current.freeValue).toBeNull();
  });

  it("§7.2 offers the typed role as a new value when no saved role matches it exactly", async () => {
    serveRoles(() => json(mentorPage([MENTOR_ROLES.partial])));
    const { result } = renderSuggestions({ search: "наставник" });

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        items: [MENTOR_ROLES.partial],
        kind: "results",
      }),
    );
    expect(result.current.freeValue).toBe("наставник");
  });

  it("§7.2 offers no new value for an empty field or a single character", async () => {
    const { rerender, result } = renderSuggestions();
    await waitFor(() => expect(suggestedLabels(result.current.state)).toHaveLength(20));

    expect(result.current.freeValue).toBeNull();

    rerender({ ...BROWSE, search: "н" });

    expect(result.current.freeValue).toBeNull();
  });

  it("§11.3 does not count a stale row as a match until the fresh results confirm it", async () => {
    const { rerender, result } = renderSuggestions();
    await waitFor(() => expect(suggestedLabels(result.current.state)).toContain("Роль 3"));

    rerender({ ...BROWSE, search: "роль 3" });

    expect(result.current.freeValue).toBe("роль 3");

    await waitFor(() =>
      expect(result.current.state).toEqual(expect.objectContaining({ isStale: false })),
    );
    expect(suggestedLabels(result.current.state)[0]).toBe("Роль 3");
    expect(result.current.freeValue).toBeNull();
  });
});

describe("useRelationshipRoleSuggestions failures", () => {
  it("E08 turns a failed suggestions request into an error state without throwing", async () => {
    serveRoles(failure);
    const { result } = renderSuggestions();

    await waitFor(() => expect(result.current.state).toEqual({ kind: "error" }));
  });

  it("E08 loads the suggestions on retry after the first request failed", async () => {
    let attempts = 0;
    serveRoles((request) => {
      attempts += 1;
      return attempts === 1 ? failure() : json(savedRolesPage(request));
    });
    const { result } = renderSuggestions();
    await waitFor(() => expect(result.current.state).toEqual({ kind: "error" }));

    act(() => result.current.retry());

    await waitFor(() => expect(suggestedLabels(result.current.state)).toHaveLength(20));
  });

  it("E06 keeps the loaded roles and flags the failed next page", async () => {
    serveRoles((request) =>
      request.searchParams.get("pageNumber") === "2" ? failure() : json(savedRolesPage(request)),
    );
    const { result } = renderSuggestions();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));
    expect(suggestedLabels(result.current.state)).toHaveLength(20);
  });

  it("E06 loads the failed next page on retry", async () => {
    let secondPageAttempts = 0;
    serveRoles((request) => {
      if (request.searchParams.get("pageNumber") !== "2") return json(savedRolesPage(request));
      secondPageAttempts += 1;
      return secondPageAttempts === 1 ? failure() : json(savedRolesPage(request));
    });
    const { result } = renderSuggestions();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));

    act(() => result.current.retry());

    await waitFor(() => expect(suggestedLabels(result.current.state)).toHaveLength(40));
  });
});
