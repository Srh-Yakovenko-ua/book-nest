import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeBookDetailsView, makeBookView } from "../components/book-details.fixtures";
import { bookKeys } from "./book-keys";
import { useBookMutationSync } from "./use-book-mutation-sync";

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("useBookMutationSync", () => {
  it("keeps the cached notes and quotes counts when a mutation answers with a plain book", () => {
    const client = new QueryClient();
    client.setQueryData(
      bookKeys.detail(BOOK_ID),
      makeBookDetailsView({ id: BOOK_ID, notesCount: 7, quotesCount: 3, title: "До правки" }),
    );
    const mutated = makeBookView({ id: BOOK_ID, title: "Після правки" });

    syncWith(client)(mutated);

    expect(client.getQueryData(bookKeys.detail(BOOK_ID))).toEqual({
      ...mutated,
      notesCount: 7,
      quotesCount: 3,
    });
  });

  it("does not cache a book without a notes count when no detail was cached", () => {
    const client = new QueryClient();

    syncWith(client)(makeBookView({ id: BOOK_ID }));

    expect(client.getQueryData(bookKeys.detail(BOOK_ID))).toBeUndefined();
  });

  it("invalidates a detail query that has no data yet instead of writing a partial book", () => {
    const client = new QueryClient();
    const detailKey = bookKeys.detail(BOOK_ID);
    client.getQueryCache().build(client, { queryKey: detailKey });

    syncWith(client)(makeBookView({ id: BOOK_ID }));

    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(client.getQueryData(detailKey)).toBeUndefined();
  });
});

function syncWith(client: QueryClient) {
  const { result } = renderHook(() => useBookMutationSync(), { wrapper: wrapperFor(client) });
  return result.current;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
