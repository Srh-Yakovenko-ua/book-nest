import type { BookCharacterRosterItem, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import type { RelationshipParticipant } from "../model/relationship-form-schema";

import { makeRosterCharacter, RELATIONSHIP_FIXTURE } from "../model/relationships.fixtures";
import { useRelationshipRosterSearch } from "./use-relationship-roster-search";

type RosterProps = {
  bookId: Nullable<string>;
  excludedIds: readonly string[];
  search: string;
};

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const SECOND_BOOK_ID = RELATIONSHIP_FIXTURE.secondBook.id;
const GERALT = makeRosterCharacter(RELATIONSHIP_FIXTURE.geralt);
const CIRI = makeRosterCharacter(RELATIONSHIP_FIXTURE.ciri);
const YENNEFER = makeRosterCharacter(RELATIONSHIP_FIXTURE.yennefer);
const BROWSE: RosterProps = { bookId: BOOK_ID, excludedIds: [], search: "" };

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
  const request = rosterRequests().at(-1);
  if (request === undefined) throw new Error("no roster request");
  return request;
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function participantOf(item: BookCharacterRosterItem): RelationshipParticipant {
  return { avatarUrl: null, id: item.characterId, name: item.name };
}

function renderRosterSearch(props: Partial<RosterProps> = {}) {
  return renderHook((current: RosterProps) => useRelationshipRosterSearch(current), {
    initialProps: { ...BROWSE, ...props },
    wrapper: makeWrapper(createTestQueryClient()),
  });
}

function rosterPage(
  items: BookCharacterRosterItem[],
  { page = 1, pagesCount = 1 }: { page?: number; pagesCount?: number } = {},
) {
  return { items, page, pagesCount, pageSize: 20, totalCount: items.length };
}

function rosterRequests(): URL[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
}

function searchTerms(): string[] {
  return rosterRequests().flatMap((request) => {
    const term = request.searchParams.get("search");
    return term === null ? [] : [term];
  });
}

function serveRoster(respond: (request: URL) => Promise<Response>) {
  fetchMock.mockImplementation((input) => respond(new URL(String(input), "http://localhost")));
}

function serveTwoPages({
  firstPage,
  secondPage,
}: {
  firstPage: BookCharacterRosterItem[];
  secondPage: BookCharacterRosterItem[];
}) {
  serveRoster((request) =>
    json(
      request.searchParams.get("pageNumber") === "2"
        ? rosterPage(secondPage, { page: 2, pagesCount: 2 })
        : rosterPage(firstPage, { pagesCount: 2 }),
    ),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  serveRoster(() => json(rosterPage([GERALT])));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useRelationshipRosterSearch browse", () => {
  it("R44 R51 browses the first 20 characters of the book by name with no search term", async () => {
    renderRosterSearch();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(lastRequest().pathname).toBe(`/api/books/${BOOK_ID}/characters`);
    expect(Object.fromEntries(lastRequest().searchParams)).toEqual({
      pageNumber: "1",
      pageSize: "20",
      sort: "name",
    });
  });

  it("R44 offers the browsed characters as selectable results", async () => {
    const { result } = renderRosterSearch();

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        kind: "results",
        participants: [participantOf(GERALT)],
      }),
    );
  });

  it("R47 R48 asks for a book first and never falls back to a global search", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { result } = renderRosterSearch({ bookId: null });

    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(result.current.state).toEqual({ kind: "no-book" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useRelationshipRosterSearch search", () => {
  it("R52 explains a one-character term instead of searching it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { result } = renderRosterSearch({ search: " Ґ " });

    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(result.current.state).toEqual({ kind: "hint" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("T04 R52 searches the trimmed term only once 300 ms have passed", async () => {
    const { rerender } = renderRosterSearch();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    rerender({ ...BROWSE, search: "  Ґе  " });
    await act(() => vi.advanceTimersByTimeAsync(299));

    expect(searchTerms()).toEqual([]);

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(searchTerms()).toEqual(["Ґе"]);
  });

  it("T04 R52 restarts a search from page 1 of the whole roster after browsing page 2", async () => {
    serveTwoPages({ firstPage: [GERALT], secondPage: [CIRI] });
    const { rerender, result } = renderRosterSearch();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(lastRequest().searchParams.get("pageNumber")).toBe("2"));

    rerender({ ...BROWSE, search: "Єн" });

    await waitFor(() => expect(searchTerms()).toEqual(["Єн"]));
    expect(Object.fromEntries(lastRequest().searchParams)).toEqual({
      pageNumber: "1",
      pageSize: "20",
      search: "Єн",
      sort: "name",
    });
  });

  it("T04 keeps the browsed rows unselectable while the typed term waits for the debounce", async () => {
    const { rerender, result } = renderRosterSearch();
    await waitFor(() => expect(result.current.state.kind).toBe("results"));

    rerender({ ...BROWSE, search: "Єн" });

    expect(result.current.state).toEqual({
      isStale: true,
      kind: "results",
      participants: [participantOf(GERALT)],
    });
  });

  it("T04 R52 replaces the browsed rows with the server's search hits", async () => {
    serveRoster((request) =>
      json(rosterPage(request.searchParams.get("search") === "Єн" ? [YENNEFER] : [GERALT, CIRI])),
    );
    const { rerender, result } = renderRosterSearch();
    await waitFor(() => expect(result.current.state.kind).toBe("results"));

    rerender({ ...BROWSE, search: "Єн" });

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        kind: "results",
        participants: [participantOf(YENNEFER)],
      }),
    );
  });
});

describe("useRelationshipRosterSearch paging", () => {
  it("R51 appends the next page without repeating a character the server sent twice", async () => {
    serveTwoPages({ firstPage: [GERALT, CIRI], secondPage: [CIRI, YENNEFER] });
    const { result } = renderRosterSearch();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    act(() => result.current.fetchNextPage());

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        kind: "results",
        participants: [participantOf(GERALT), participantOf(CIRI), participantOf(YENNEFER)],
      }),
    );
  });

  it("R45 leaves the already chosen character out of the results", async () => {
    serveRoster(() => json(rosterPage([GERALT, CIRI])));
    const { result } = renderRosterSearch({ excludedIds: [GERALT.characterId] });

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        kind: "results",
        participants: [participantOf(CIRI)],
      }),
    );
  });

  it("R45 R51 keeps paging when a page holds only the excluded character", async () => {
    serveTwoPages({ firstPage: [GERALT], secondPage: [CIRI] });
    const { result } = renderRosterSearch({ excludedIds: [GERALT.characterId] });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    act(() => result.current.fetchNextPage());

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        kind: "results",
        participants: [participantOf(CIRI)],
      }),
    );
  });
});

describe("useRelationshipRosterSearch failures", () => {
  it("R51 reports a failed first page as an error", async () => {
    serveRoster(failure);
    const { result } = renderRosterSearch();

    await waitFor(() => expect(result.current.state).toEqual({ kind: "error" }));
  });

  it("R51 loads the first page again on retry after it failed", async () => {
    fetchMock.mockImplementationOnce(failure);
    const { result } = renderRosterSearch();
    await waitFor(() => expect(result.current.state).toEqual({ kind: "error" }));

    act(() => result.current.retry());

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        kind: "results",
        participants: [participantOf(GERALT)],
      }),
    );
  });

  it("R51 keeps the loaded rows and flags the failed next page", async () => {
    serveRoster((request) =>
      request.searchParams.get("pageNumber") === "2"
        ? failure()
        : json(rosterPage([GERALT], { pagesCount: 2 })),
    );
    const { result } = renderRosterSearch();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));
    expect(result.current.state).toEqual({
      isStale: false,
      kind: "results",
      participants: [participantOf(GERALT)],
    });
  });

  it("R51 requests the failed next page again on retry and appends it", async () => {
    let secondPageAttempts = 0;
    serveRoster((request) => {
      if (request.searchParams.get("pageNumber") !== "2") {
        return json(rosterPage([GERALT], { pagesCount: 2 }));
      }
      secondPageAttempts += 1;
      return secondPageAttempts === 1
        ? failure()
        : json(rosterPage([CIRI], { page: 2, pagesCount: 2 }));
    });
    const { result } = renderRosterSearch();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));

    act(() => result.current.retry());

    await waitFor(() =>
      expect(result.current.state).toEqual({
        isStale: false,
        kind: "results",
        participants: [participantOf(GERALT), participantOf(CIRI)],
      }),
    );
  });
});

describe("useRelationshipRosterSearch book switch", () => {
  it("R53 requests the roster of the new book from page 1", async () => {
    serveTwoPages({ firstPage: [GERALT], secondPage: [CIRI] });
    const { rerender, result } = renderRosterSearch();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(lastRequest().searchParams.get("pageNumber")).toBe("2"));

    rerender({ ...BROWSE, bookId: SECOND_BOOK_ID });

    await waitFor(() =>
      expect(lastRequest().pathname).toBe(`/api/books/${SECOND_BOOK_ID}/characters`),
    );
    expect(lastRequest().searchParams.get("pageNumber")).toBe("1");
  });

  it("R53 keeps the old book's rows only as unselectable until the new roster arrives", async () => {
    serveRoster((request) =>
      request.pathname.includes(SECOND_BOOK_ID)
        ? new Promise<Response>(() => undefined)
        : json(rosterPage([GERALT])),
    );
    const { rerender, result } = renderRosterSearch();
    await waitFor(() => expect(result.current.state.kind).toBe("results"));

    rerender({ ...BROWSE, bookId: SECOND_BOOK_ID });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.state).toEqual({
      isStale: true,
      kind: "results",
      participants: [participantOf(GERALT)],
    });
  });
});
