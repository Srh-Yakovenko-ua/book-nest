import type { CancelledFollowUpView } from "@app/shared";

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryClientWrapper } from "@/test-query-cache";
import { createTestQueryClient } from "@/test-utils";

import { useCancelledFollowUp } from "./use-cancelled-follow-up";

const CANCELLED_FOLLOW_UP_PATH = "/api/delivery/books/history/cancelled-follow-up";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const view: CancelledFollowUpView = {
  outcomes: {
    borrowed: 4,
    inLibrary: 3,
    reordered: 1,
    totalBooksCount: 11,
    unresolved: 1,
    wishlist: 2,
  },
  plans: null,
  unresolved: null,
};

function requestUrl(input: RequestInfo | URL): URL {
  return new URL(String(input), "http://localhost");
}

function sentRequests() {
  return fetchMock.mock.calls.map(([input, init]) => {
    const url = requestUrl(input);
    return { body: init?.body, method: init?.method, path: url.pathname, search: url.search };
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) =>
    init?.method === "GET" && requestUrl(input).pathname === CANCELLED_FOLLOW_UP_PATH
      ? Promise.resolve(
          new Response(JSON.stringify(view), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }),
        )
      : Promise.reject(new Error(`unexpected fetch: ${init?.method} ${String(input)}`)),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCancelledFollowUp", () => {
  it("asks the server for the tally without passing a single list parameter", async () => {
    const client = createTestQueryClient();

    const { result } = renderHook(() => useCancelledFollowUp({ enabled: true }), {
      wrapper: queryClientWrapper(client),
    });

    await waitFor(() =>
      expect(sentRequests()).toEqual([
        { body: undefined, method: "GET", path: CANCELLED_FOLLOW_UP_PATH, search: "" },
      ]),
    );
    await waitFor(() => expect(result.current.data).toEqual(view));
  });

  it("keeps one cache entry, so search and filters cannot fork the tally", async () => {
    const client = createTestQueryClient();

    renderHook(() => useCancelledFollowUp({ enabled: true }), {
      wrapper: queryClientWrapper(client),
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    renderHook(() => useCancelledFollowUp({ enabled: true }), {
      wrapper: queryClientWrapper(client),
    });
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1));

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("stays quiet while the reader is not on the cancelled tab", async () => {
    const client = createTestQueryClient();

    renderHook(() => useCancelledFollowUp({ enabled: false }), {
      wrapper: queryClientWrapper(client),
    });

    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
