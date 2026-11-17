import { describe, expect, it } from "vitest";

import { getSeriesControllerFavoriteContinuationsQueryKey } from "@/shared/api/generated/endpoints/series/series";

import { matchesSeriesKey, seriesKeys } from "./series-keys";

const FAVORITE_CONTINUATIONS_KEY = getSeriesControllerFavoriteContinuationsQueryKey({ limit: 50 });

describe("matchesSeriesKey", () => {
  it("matches the generated favorite continuations query", () => {
    expect(matchesSeriesKey({ queryKey: FAVORITE_CONTINUATIONS_KEY })).toBe(true);
  });

  it("matches the series overview built by the key factory", () => {
    expect(matchesSeriesKey({ queryKey: seriesKeys.overview })).toBe(true);
  });
});
