import "@testing-library/jest-dom/vitest";

import type { LoanContactView } from "@app/shared";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bookKeys } from "@/features/books/api/book-keys";

import { loanKeys } from "./loan-keys";
import { useArchiveLoanContact } from "./use-archive-loan-contact";
import { useLoanContact } from "./use-loan-contact";
import { useRestoreLoanContact } from "./use-restore-loan-contact";
import { useUpdateLoanContact } from "./use-update-loan-contact";

const CONTACT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function cachingQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false, staleTime: 0 },
    },
  });
}

function contactView(overrides: Partial<LoanContactView> = {}): LoanContactView {
  return {
    archivedAt: null,
    contact: "ihor@example.com",
    createdAt: "2026-02-01T10:00:00.000Z",
    id: CONTACT_ID,
    loanCount: 2,
    name: "Ігор",
    updatedAt: "2026-02-01T10:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function lastCall() {
  return fetchMock.mock.calls.at(-1);
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

async function seedQuery(client: QueryClient, queryKey: readonly unknown[]): Promise<void> {
  await client.fetchQuery({ queryFn: () => Promise.resolve({ items: [] }), queryKey });
  expect(client.getQueryState(queryKey)?.isInvalidated).toBe(false);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(contactView())));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useLoanContact", () => {
  it("reads one contact by its id", async () => {
    const { result } = renderHook(() => useLoanContact(CONTACT_ID), {
      wrapper: makeWrapper(cachingQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toEqual(contactView()));
    expect(String(lastCall()?.[0])).toContain(`/api/loans/contacts/${CONTACT_ID}`);
  });

  it("asks for nothing until a contact is chosen", () => {
    renderHook(() => useLoanContact(null), { wrapper: makeWrapper(cachingQueryClient()) });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useUpdateLoanContact", () => {
  it("refreshes the loans, the history and the books that show the person", async () => {
    const client = cachingQueryClient();
    const seeded = [
      loanKeys.contacts.search(""),
      loanKeys.list({ type: "lent_to_someone" }),
      loanKeys.history.lists,
      loanKeys.history.overviews,
      bookKeys.root,
    ] as const;
    for (const queryKey of seeded) await seedQuery(client, queryKey);

    const { result } = renderHook(() => useUpdateLoanContact(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({
        contactId: CONTACT_ID,
        payload: { contact: "+380001112233" },
      });
    });

    for (const queryKey of seeded) {
      await waitFor(() => expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true));
    }
  });

  it("puts the updated contact straight into the detail cache", async () => {
    const client = cachingQueryClient();
    const updated = contactView({ contact: "+380001112233" });
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(updated)));

    const { result } = renderHook(() => useUpdateLoanContact(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ contactId: CONTACT_ID, payload: { name: "Ігор" } });
    });

    expect(client.getQueryData(loanKeys.contacts.detail(CONTACT_ID))).toEqual(updated);
  });
});

describe("useArchiveLoanContact", () => {
  it("posts to the archive route and refreshes the contact list", async () => {
    const client = cachingQueryClient();
    const listKey = loanKeys.contacts.search("");
    await seedQuery(client, listKey);
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(contactView({ archivedAt: "2026-08-21T10:00:00.000Z" }))),
    );

    const { result } = renderHook(() => useArchiveLoanContact(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync(CONTACT_ID);
    });

    expect(String(lastCall()?.[0])).toContain(`/api/loans/contacts/${CONTACT_ID}/archive`);
    expect(lastCall()?.[1]?.method).toBe("POST");
    await waitFor(() => expect(client.getQueryState(listKey)?.isInvalidated).toBe(true));
  });
});

describe("useArchiveLoanContact and the book caches", () => {
  it("leaves the book caches alone, since archiving renames nobody", async () => {
    const client = cachingQueryClient();
    await seedQuery(client, bookKeys.root);
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(contactView({ archivedAt: "2026-08-21T10:00:00.000Z" }))),
    );

    const { result } = renderHook(() => useArchiveLoanContact(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync(CONTACT_ID);
    });

    expect(client.getQueryState(bookKeys.root)?.isInvalidated).toBe(false);
  });
});

describe("useRestoreLoanContact", () => {
  it("posts to the restore route and refreshes the contact list", async () => {
    const client = cachingQueryClient();
    const listKey = loanKeys.contacts.search("");
    await seedQuery(client, listKey);

    const { result } = renderHook(() => useRestoreLoanContact(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync(CONTACT_ID);
    });

    expect(String(lastCall()?.[0])).toContain(`/api/loans/contacts/${CONTACT_ID}/restore`);
    expect(lastCall()?.[1]?.method).toBe("POST");
    await waitFor(() => expect(client.getQueryState(listKey)?.isInvalidated).toBe(true));
  });
});
