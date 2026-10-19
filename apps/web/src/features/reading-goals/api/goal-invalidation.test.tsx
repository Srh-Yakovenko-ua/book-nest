import type { QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChangeReadingStatus } from "@/features/books/api/use-reading-progress";
import { makeBookView } from "@/features/books/components/book-details.fixtures";

import { makeReadingGoalView } from "../model/reading-goals.fixtures";
import { goalKeys } from "./goal-keys";
import { useDeleteGoal } from "./use-delete-goal";
import { useUpdateGoal } from "./use-update-goal";

const GOAL_ID = "goal-1";

const SEEDED_KEYS = {
  activity: goalKeys.activity(GOAL_ID, {}),
  books: goalKeys.books(GOAL_ID, { scope: "all" }),
  catalog: goalKeys.catalog({ sort: "created_desc" }),
  detail: goalKeys.detail(GOAL_ID),
  forList: goalKeys.forList("list-1"),
  overview: goalKeys.overview,
} as const satisfies Record<string, QueryKey>;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function isInvalidated(client: QueryClient, key: QueryKey): boolean {
  return client.getQueryState(key)?.isInvalidated === true;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function seededClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  for (const key of Object.values(SEEDED_KEYS)) client.setQueryData(key, { marker: "goal" });
  return client;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("goal cache freshness", () => {
  it("refreshes the catalog, overview, detail and list card after an edit", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeReadingGoalView()));
    const client = seededClient();

    const { result } = renderHook(() => useUpdateGoal(), { wrapper: makeWrapper(client) });
    result.current.mutate({ goalId: GOAL_ID, input: { name: "Осінній забіг" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of Object.values(SEEDED_KEYS)) expect(isInvalidated(client, key)).toBe(true);
  });

  it("drops the deleted goal's own queries and refreshes the rest", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = seededClient();

    const { result } = renderHook(() => useDeleteGoal(), { wrapper: makeWrapper(client) });
    result.current.mutate({ goalId: GOAL_ID });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryState(SEEDED_KEYS.detail)).toBeUndefined();
    expect(client.getQueryState(SEEDED_KEYS.books)).toBeUndefined();
    expect(client.getQueryState(SEEDED_KEYS.activity)).toBeUndefined();
    expect(isInvalidated(client, SEEDED_KEYS.catalog)).toBe(true);
    expect(isInvalidated(client, SEEDED_KEYS.overview)).toBe(true);
    expect(isInvalidated(client, SEEDED_KEYS.forList)).toBe(true);
  });

  it("refreshes goal views after a reading-status change", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeBookView()));
    const client = seededClient();

    const { result } = renderHook(() => useChangeReadingStatus(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ id: makeBookView().id, payload: { status: "finished" } });

    await waitFor(() => expect(isInvalidated(client, SEEDED_KEYS.forList)).toBe(true));
    expect(isInvalidated(client, SEEDED_KEYS.detail)).toBe(true);
    expect(isInvalidated(client, SEEDED_KEYS.catalog)).toBe(true);
  });

  it("leaves goal views alone when the reading mutation fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "nope" }, 500));
    const client = seededClient();

    const { result } = renderHook(() => useChangeReadingStatus(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ id: makeBookView().id, payload: { status: "finished" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isInvalidated(client, SEEDED_KEYS.forList)).toBe(false);
  });
});
