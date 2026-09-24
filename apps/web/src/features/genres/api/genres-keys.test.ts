import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { genresKeys, invalidateGenreDerivedQueries } from "./genres-keys";

const LIST_PARAMS = { filter: "all", sort: "books_count_desc" } as const;

const SEEDED_KEYS = {
  catalog: ["genres"],
  facets: genresKeys.facets({ q: "фе" }),
  overview: genresKeys.overview,
  recent: ["genres", "recent"],
  stats: genresKeys.stats(LIST_PARAMS),
  summary: genresKeys.summary,
} as const;

function isInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]): boolean {
  return queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
}

function seededClient(): QueryClient {
  const queryClient = new QueryClient();
  for (const key of Object.values(SEEDED_KEYS)) queryClient.setQueryData(key, {});
  return queryClient;
}

describe("invalidateGenreDerivedQueries", () => {
  it("refreshes the list, facets, summary and overview of the Genres page", async () => {
    const queryClient = seededClient();

    await invalidateGenreDerivedQueries(queryClient);

    expect(isInvalidated(queryClient, SEEDED_KEYS.stats)).toBe(true);
    expect(isInvalidated(queryClient, SEEDED_KEYS.facets)).toBe(true);
    expect(isInvalidated(queryClient, SEEDED_KEYS.summary)).toBe(true);
    expect(isInvalidated(queryClient, SEEDED_KEYS.overview)).toBe(true);
  });

  it("leaves the global genre catalog and recent usage untouched", async () => {
    const queryClient = seededClient();

    await invalidateGenreDerivedQueries(queryClient);

    expect(isInvalidated(queryClient, SEEDED_KEYS.catalog)).toBe(false);
    expect(isInvalidated(queryClient, SEEDED_KEYS.recent)).toBe(false);
  });
});

describe("genresKeys", () => {
  it("keeps the page number out of the list identity", () => {
    expect(genresKeys.stats(LIST_PARAMS)).toEqual(["/api/genres", "stats", LIST_PARAMS]);
  });
});
