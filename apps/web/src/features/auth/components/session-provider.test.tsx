import type { UserView } from "@app/shared";
import type { ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthBridge } from "@/lib/auth-bridge";
import { renderWithProviders, screen, waitFor } from "@/test-utils";

import { useAuthStore } from "../model/auth-store";
import { SessionProvider, useSession } from "./session-provider";

const readers = {
  first: {
    createdAt: "2026-01-01T00:00:00.000Z",
    dateOfBirth: null,
    email: "first-reader@book.nest",
    emailVerified: true,
    id: "6f1c2a3e-8b4d-4e5f-9a6b-1c2d3e4f5a6b",
    name: "First Reader",
    nickname: null,
    role: "user",
  },
  second: {
    createdAt: "2026-02-01T00:00:00.000Z",
    dateOfBirth: null,
    email: "second-reader@book.nest",
    emailVerified: true,
    id: "0b7e9d4c-3f2a-4c1b-8d5e-7a6f5e4d3c2b",
    name: "Second Reader",
    nickname: null,
    role: "user",
  },
} satisfies Record<string, UserView>;

const cachedBooks = {
  data: { items: [{ id: "book-1", title: "The Hobbit" }] },
  queryKey: ["/api/books", "list"],
};

const fetchMock = vi.fn();

function fetchSignedInShelfTitle() {
  return Promise.resolve(`${useAuthStore.getState().user?.name ?? "Nobody"}'s shelf`);
}

async function mountSession(content: ReactNode = <span>app</span>) {
  const { queryClient } = renderWithProviders(<SessionProvider>{content}</SessionProvider>);
  await waitFor(() => expect(useAuthStore.getState().status).toBe("unauthenticated"));
  queryClient.setQueryDefaults(cachedBooks.queryKey, { gcTime: Infinity });
  return queryClient;
}

function ShelfTitle() {
  const { data } = useQuery({ queryFn: fetchSignedInShelfTitle, queryKey: cachedBooks.queryKey });
  return <p>{data}</p>;
}

function SignedInOnly({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user === null ? null : children;
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, status: "unauthenticated", user: null });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST" && url.endsWith("/api/auth/refresh")) {
      return Promise.resolve(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          headers: { "Content-Type": "application/json" },
          status: 401,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SessionProvider", () => {
  it("drops the cached server data when the session refresh fails", async () => {
    const queryClient = await mountSession();
    act(() => useAuthStore.getState().setSession("token-a", readers.first));
    queryClient.setQueryData(cachedBooks.queryKey, cachedBooks.data);

    act(() => getAuthBridge()?.onRefreshFailed());

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("shows the next reader's shelf in place of the previous reader's", async () => {
    await mountSession(
      <SignedInOnly>
        <ShelfTitle />
      </SignedInOnly>,
    );
    act(() => useAuthStore.getState().setSession("token-a", readers.first));
    await screen.findByText("First Reader's shelf");

    act(() => useAuthStore.getState().setSession("token-b", readers.second));

    expect(await screen.findByText("Second Reader's shelf")).toBeInTheDocument();
    expect(screen.queryByText("First Reader's shelf")).not.toBeInTheDocument();
  });

  it("forgets the previous reader's unobserved data when another reader signs in", async () => {
    const queryClient = await mountSession();
    act(() => useAuthStore.getState().setSession("token-a", readers.first));
    queryClient.setQueryData(cachedBooks.queryKey, cachedBooks.data);

    act(() => useAuthStore.getState().setSession("token-b", readers.second));

    expect(queryClient.getQueryData(cachedBooks.queryKey)).toBeUndefined();
  });

  it("keeps the cached server data when the same reader gets a rotated token", async () => {
    const queryClient = await mountSession();
    act(() => useAuthStore.getState().setSession("token-a", readers.first));
    queryClient.setQueryData(cachedBooks.queryKey, cachedBooks.data);

    act(() => useAuthStore.getState().setSession("token-a-rotated", { ...readers.first }));

    expect(queryClient.getQueryData(cachedBooks.queryKey)).toEqual(cachedBooks.data);
  });

  it("keeps the cached server data when a reader signs in from a signed-out state", async () => {
    const queryClient = await mountSession();
    queryClient.setQueryData(cachedBooks.queryKey, cachedBooks.data);

    act(() => useAuthStore.getState().setSession("token-a", readers.first));

    expect(queryClient.getQueryData(cachedBooks.queryKey)).toEqual(cachedBooks.data);
  });
});
