import type { QueryKey } from "@tanstack/react-query";

import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { seriesKeys } from "@/features/series/api/series-keys";
import { statisticsKeys } from "@/features/statistics/api/statistics-keys";
import { matchesAnyKeyPrefix } from "@/lib/query-keys";

import { publisherChangeEffects } from "./publisher-change-effects";
import { publisherKeys } from "./publisher-keys";

type CacheStatus = "fresh" | "removed" | "stale";

const KEYS = {
  bookList: ["/api/books", "list", { page: 1 }],
  detail: publisherKeys.detail("pub-1"),
  otherDetail: publisherKeys.detail("pub-2"),
  overview: publisherKeys.overview("pub-1"),
  picker: publisherKeys.picker.search("", "uk"),
  scopedBookList: ["/api/books", "list", { publisher: ["pub-1"] }],
  series: seriesKeys.overview,
  statistics: statisticsKeys.overview({ year: 2026 }),
  summary: publisherKeys.summary("uk"),
} as const satisfies Record<string, QueryKey>;

function cacheStatuses(client: QueryClient, keys: readonly QueryKey[]): CacheStatus[] {
  return keys.map((key): CacheStatus => {
    const state = client.getQueryState(key);
    if (state === undefined) return "removed";
    return state.isInvalidated ? "stale" : "fresh";
  });
}

function seededClient(keys: readonly QueryKey[]): QueryClient {
  const client = new QueryClient();
  for (const key of keys) client.setQueryData(key, {});
  return client;
}

async function watchedQuery(client: QueryClient, queryKey: QueryKey) {
  const queryFn = vi.fn(() => Promise.resolve({}));
  await client.prefetchQuery({ queryFn, queryKey });
  const observer = new QueryObserver(client, { queryFn, queryKey, staleTime: Infinity });
  return { queryFn, unsubscribe: observer.subscribe(() => undefined) };
}

describe("publisherChangeEffects", () => {
  it("refreshes the publisher catalog, the picker, books, series and statistics after an update", async () => {
    const keys = [KEYS.summary, KEYS.picker, KEYS.bookList, KEYS.series, KEYS.statistics];
    const client = seededClient(keys);

    await publisherChangeEffects.publishersChanged(client, { change: "updated" });

    expect(cacheStatuses(client, keys)).toEqual(["stale", "stale", "stale", "stale", "stale"]);
  });

  it("keeps a query the caller asked to keep fresh after an update", async () => {
    const keys = [KEYS.detail, KEYS.summary];
    const client = seededClient(keys);

    await publisherChangeEffects.publishersChanged(client, {
      change: "updated",
      keep: [matchesAnyKeyPrefix(publisherKeys.detail("pub-1"))],
    });

    expect(cacheStatuses(client, keys)).toEqual(["fresh", "stale"]);
  });

  it("drops the deleted publisher's detail, overview and scoped book list from the cache", async () => {
    const keys = [KEYS.detail, KEYS.overview, KEYS.scopedBookList];
    const client = seededClient(keys);

    await publisherChangeEffects.publisherRemoved(client, {
      change: "deleted",
      publisherId: "pub-1",
    });

    expect(cacheStatuses(client, keys)).toEqual(["removed", "removed", "removed"]);
  });

  it("refreshes other publishers, the picker and unscoped books after a delete", async () => {
    const keys = [KEYS.otherDetail, KEYS.picker, KEYS.bookList];
    const client = seededClient(keys);

    await publisherChangeEffects.publisherRemoved(client, {
      change: "deleted",
      publisherId: "pub-1",
    });

    expect(cacheStatuses(client, keys)).toEqual(["stale", "stale", "stale"]);
  });

  it("retires the watched detail of a deleted publisher without refetching it", async () => {
    const client = seededClient([KEYS.otherDetail]);
    const watched = await watchedQuery(client, KEYS.detail);

    await publisherChangeEffects.publisherRemoved(client, {
      change: "deleted",
      publisherId: "pub-1",
    });
    watched.unsubscribe();

    expect(watched.queryFn).toHaveBeenCalledTimes(1);
    expect(cacheStatuses(client, [KEYS.otherDetail])).toEqual(["stale"]);
  });

  it("leaves series and statistics fresh after a delete", async () => {
    const keys = [KEYS.bookList, KEYS.series, KEYS.statistics];
    const client = seededClient(keys);

    await publisherChangeEffects.publisherRemoved(client, {
      change: "deleted",
      publisherId: "pub-1",
    });

    expect(cacheStatuses(client, keys)).toEqual(["stale", "fresh", "fresh"]);
  });

  it("refreshes other publishers, the picker, books, series and statistics after a merge", async () => {
    const keys = [KEYS.otherDetail, KEYS.picker, KEYS.bookList, KEYS.series, KEYS.statistics];
    const client = seededClient(keys);

    await publisherChangeEffects.publisherRemoved(client, {
      change: "merged",
      publisherId: "pub-1",
    });

    expect(cacheStatuses(client, keys)).toEqual(["stale", "stale", "stale", "stale", "stale"]);
  });
});
