import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { genresKeys } from "@/features/genres/api/genres-keys";

import { useDeliverySync } from "./delivery-cache";

const GENRE_DERIVED_KEYS = [
  genresKeys.stats({ filter: "all", sort: "books_count_desc" }),
  genresKeys.facets({}),
  genresKeys.summary,
  genresKeys.overview,
] as const;

const UNRELATED_KEY = ["/api/lists"] as const;

describe("useDeliverySync", () => {
  it("refreshes Genre analytics because deliveries change ownership status", () => {
    const client = new QueryClient();
    for (const key of [...GENRE_DERIVED_KEYS, UNRELATED_KEY]) client.setQueryData(key, {});
    const { result } = renderHook(() => useDeliverySync(), { wrapper: wrapperFor(client) });

    act(() => result.current());

    expect(GENRE_DERIVED_KEYS.map((key) => isInvalidated(client, key))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isInvalidated(client, UNRELATED_KEY)).toBe(false);
  });
});

function isInvalidated(client: QueryClient, queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
