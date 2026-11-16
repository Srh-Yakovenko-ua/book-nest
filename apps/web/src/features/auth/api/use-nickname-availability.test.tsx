import type { ReactNode } from "react";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import { useNicknameAvailability } from "./use-nickname-availability";

const VALID_NICKNAME_REQUEST = "/api/auth/nickname-available?nickname=reader_1";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function json(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function nicknameRequests(): string[] {
  return fetchMock.mock.calls.map(([input]) => {
    const url = new URL(String(input), "http://localhost");
    return `${url.pathname}${url.search}`;
  });
}

function renderNicknameAvailability(initialNickname: string) {
  return renderHook((nickname: string) => useNicknameAvailability(nickname), {
    initialProps: initialNickname,
    wrapper: makeWrapper(createTestQueryClient()),
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => json({ available: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useNicknameAvailability", () => {
  it("queries the nickname endpoint once the debounced nickname is valid", async () => {
    const { rerender, result } = renderNicknameAvailability("");

    rerender("reader_1");

    await waitFor(() => expect(result.current.data).toEqual({ available: true }), {
      timeout: 2000,
    });
    expect(nicknameRequests()).toEqual([VALID_NICKNAME_REQUEST]);
  });

  it("asks only after the nickname has stayed unchanged for 400 ms", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { rerender } = renderNicknameAvailability("");

    rerender("reader_1");
    await act(() => vi.advanceTimersByTimeAsync(399));

    expect(nicknameRequests()).toEqual([]);

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(nicknameRequests()).toEqual([VALID_NICKNAME_REQUEST]);
  });

  it("does not call the endpoint for an invalid nickname", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { rerender, result } = renderNicknameAvailability("");

    rerender("ab");
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it("rejects a malformed availability body", async () => {
    fetchMock.mockImplementation(() => json({ available: "yes" }));
    const { result } = renderNicknameAvailability("reader_1");
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeUndefined();
  });
});
