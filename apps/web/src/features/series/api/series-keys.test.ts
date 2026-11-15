import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { getSeriesControllerFavoriteContinuationsQueryKey } from "@/shared/api/generated/endpoints/series/series";

import { invalidateSeriesQueries, seriesKeys } from "./series-keys";

const FAVORITE_CONTINUATIONS_KEY = getSeriesControllerFavoriteContinuationsQueryKey({ limit: 50 });

function isInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]): boolean {
  return queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
}

describe("invalidateSeriesQueries", () => {
  it("invalidates the generated favorite continuations query", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(FAVORITE_CONTINUATIONS_KEY, {});

    await invalidateSeriesQueries(queryClient);

    expect(isInvalidated(queryClient, FAVORITE_CONTINUATIONS_KEY)).toBe(true);
  });

  it("invalidates the series overview built by the key factory", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(seriesKeys.overview, {});

    await invalidateSeriesQueries(queryClient);

    expect(isInvalidated(queryClient, seriesKeys.overview)).toBe(true);
  });
});
