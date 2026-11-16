import type { QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { vi } from "vitest";

type CacheStatus = "fresh" | "removed" | "stale";

export function cacheStatuses(client: QueryClient, keys: readonly QueryKey[]): CacheStatus[] {
  return keys.map((key): CacheStatus => {
    const state = client.getQueryState(key);
    if (state === undefined) return "removed";
    return state.isInvalidated ? "stale" : "fresh";
  });
}

export function queryClientWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export function seededClient(keys: readonly QueryKey[]): QueryClient {
  const client = new QueryClient();
  for (const key of keys) client.setQueryData(key, {});
  return client;
}

export function staleFlags(client: QueryClient, keys: readonly QueryKey[]): boolean[] {
  return keys.map((key) => client.getQueryState(key)?.isInvalidated ?? false);
}

export async function watchedQuery(client: QueryClient, queryKey: QueryKey) {
  const queryFn = vi.fn(() => Promise.resolve({}));
  await client.prefetchQuery({ queryFn, queryKey });
  const observer = new QueryObserver(client, { queryFn, queryKey, staleTime: Infinity });
  return { queryFn, unsubscribe: observer.subscribe(() => undefined) };
}
