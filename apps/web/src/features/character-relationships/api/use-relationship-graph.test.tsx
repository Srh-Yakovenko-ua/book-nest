import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import type { RelationshipGraphCriteria } from "../model/relationship-graph-criteria";
import type { RelationshipGraphScope } from "../model/relationship-graph-scope";

import { RELATIONSHIP_GRAPH_CRITERIA } from "../model/relationship-graph-criteria";
import { makeRelationshipGraph, RELATIONSHIP_FIXTURE } from "../model/relationships.fixtures";
import { useRelationshipGraph } from "./use-relationship-graph";

type GraphHookProps = {
  criteria: RelationshipGraphCriteria;
  scope: RelationshipGraphScope;
};

type GraphReply = (url: URL) => Promise<Response>;

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const FIRST_BOOK_ID = RELATIONSHIP_FIXTURE.book.id;
const SECOND_BOOK_ID = RELATIONSHIP_FIXTURE.secondBook.id;
const SERIES_ID = "5e5e5e5e-0000-4000-8000-000000000005";

const DEFAULT_CRITERIA: RelationshipGraphCriteria = RELATIONSHIP_GRAPH_CRITERIA.defaults;

const GRAPH_PATHS = {
  book: `/api/books/${BOOK_ID}/character-graph`,
  series: `/api/series/${SERIES_ID}/character-graph`,
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let replyToGraph: GraphReply;

function graphFor(url: URL): Promise<Response> {
  const context = url.searchParams.get("contextBookId") ?? "default";
  const mode = url.searchParams.get("mode") ?? "unknown";
  return Promise.resolve(
    new Response(JSON.stringify(makeRelationshipGraph({ graphVersion: `${context}:${mode}` })), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

function graphRequests(): URL[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function onlyRequest(): URL {
  const requests = graphRequests();
  expect(requests).toHaveLength(1);
  const [request] = requests;
  if (request === undefined) throw new Error("no graph request");
  return request;
}

function pendingForever(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

function renderGraph(initialProps: GraphHookProps) {
  return renderHook((props: GraphHookProps) => useRelationshipGraph(props), {
    initialProps,
    wrapper: makeWrapper(createTestQueryClient()),
  });
}

function seriesScope(contextBookId: Nullable<string>): RelationshipGraphScope {
  return { contextBookId, kind: "series", seriesId: SERIES_ID };
}

beforeEach(() => {
  replyToGraph = graphFor;
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === GRAPH_PATHS.book || url.pathname === GRAPH_PATHS.series) {
      return replyToGraph(url);
    }
    return Promise.reject(new Error(`unexpected fetch: ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useRelationshipGraph requests", () => {
  it("loads a book graph from the book's own endpoint", async () => {
    const { result } = renderGraph({
      criteria: DEFAULT_CRITERIA,
      scope: { bookId: BOOK_ID, kind: "book" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const request = onlyRequest();
    expect(request.pathname).toBe(GRAPH_PATHS.book);
    expect(Object.fromEntries(request.searchParams)).toEqual({ mode: "all" });
  });

  it("loads a series graph in the chosen book's reading context", async () => {
    const { result } = renderGraph({
      criteria: DEFAULT_CRITERIA,
      scope: seriesScope(FIRST_BOOK_ID),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const request = onlyRequest();
    expect(request.pathname).toBe(GRAPH_PATHS.series);
    expect(Object.fromEntries(request.searchParams)).toEqual({
      contextBookId: FIRST_BOOK_ID,
      mode: "all",
    });
  });

  it("leaves the series context to the server when no book is chosen", async () => {
    const { result } = renderGraph({ criteria: DEFAULT_CRITERIA, scope: seriesScope(null) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Object.fromEntries(onlyRequest().searchParams)).toEqual({ mode: "all" });
  });

  it("sends every chosen criterion and never a request to reveal edges", async () => {
    const { result } = renderGraph({
      criteria: {
        categories: ["family", "romantic"],
        clusterBy: "importance",
        depth: 2,
        focusCharacterId: RELATIONSHIP_FIXTURE.geralt.id,
        mode: "all",
        relationshipTypes: ["guardian_of", "enemy_of"],
      },
      scope: { bookId: BOOK_ID, kind: "book" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const params = onlyRequest().searchParams;
    expect({
      categories: params.getAll("categories"),
      clusterBy: params.get("clusterBy"),
      depth: params.get("depth"),
      focusCharacterId: params.get("focusCharacterId"),
      mode: params.get("mode"),
      relationshipTypes: params.getAll("relationshipTypes"),
      revealEdgeIds: params.getAll("revealEdgeIds"),
    }).toEqual({
      categories: ["family", "romantic"],
      clusterBy: "importance",
      depth: "2",
      focusCharacterId: RELATIONSHIP_FIXTURE.geralt.id,
      mode: "all",
      relationshipTypes: ["guardian_of", "enemy_of"],
      revealEdgeIds: [],
    });
  });
});

describe("useRelationshipGraph while the reading context changes", () => {
  it("shows no graph from the previous book while the new book's graph loads", async () => {
    replyToGraph = (url) =>
      url.searchParams.get("contextBookId") === SECOND_BOOK_ID ? pendingForever() : graphFor(url);
    const { rerender, result } = renderGraph({
      criteria: DEFAULT_CRITERIA,
      scope: seriesScope(FIRST_BOOK_ID),
    });
    await waitFor(() => expect(result.current.data?.graphVersion).toBe(`${FIRST_BOOK_ID}:all`));

    rerender({ criteria: DEFAULT_CRITERIA, scope: seriesScope(SECOND_BOOK_ID) });

    await waitFor(() =>
      expect(
        graphRequests().filter(
          (request) => request.searchParams.get("contextBookId") === SECOND_BOOK_ID,
        ),
      ).toHaveLength(1),
    );
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("keeps the current graph on screen while filters change within the same book", async () => {
    replyToGraph = (url) =>
      url.searchParams.get("mode") === "family" ? pendingForever() : graphFor(url);
    const { rerender, result } = renderGraph({
      criteria: DEFAULT_CRITERIA,
      scope: seriesScope(FIRST_BOOK_ID),
    });
    await waitFor(() => expect(result.current.data?.graphVersion).toBe(`${FIRST_BOOK_ID}:all`));

    rerender({
      criteria: { ...DEFAULT_CRITERIA, mode: "family" },
      scope: seriesScope(FIRST_BOOK_ID),
    });

    await waitFor(() =>
      expect(
        graphRequests().filter((request) => request.searchParams.get("mode") === "family"),
      ).toHaveLength(1),
    );
    expect(result.current.data?.graphVersion).toBe(`${FIRST_BOOK_ID}:all`);
    expect(result.current.isPlaceholderData).toBe(true);
  });
});
