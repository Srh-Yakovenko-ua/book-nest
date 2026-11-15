import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { getStatisticsControllerGetOverviewQueryKey } from "@/shared/api/generated/endpoints/statistics/statistics";

import {
  invalidateStatisticsQueries,
  matchesStatisticsKey,
  statisticsKeys,
} from "./statistics-keys";

describe("matchesStatisticsKey", () => {
  it("matches every overview variant of the generated client", () => {
    const keys = [
      getStatisticsControllerGetOverviewQueryKey(),
      getStatisticsControllerGetOverviewQueryKey({ period: "year", year: 2026 }),
      getStatisticsControllerGetOverviewQueryKey({
        compare: "same_period_last_year",
        period: "year",
        year: 2025,
      }),
      getStatisticsControllerGetOverviewQueryKey({ period: "all_time" }),
    ];

    for (const queryKey of keys) {
      expect(matchesStatisticsKey({ queryKey })).toBe(true);
    }
  });

  it("matches a lazy reading-day detail key", () => {
    const queryKey = statisticsKeys.readingDay("2026-03-02");

    expect(matchesStatisticsKey({ queryKey })).toBe(true);
  });

  it("matches a reading month summary key", () => {
    const queryKey = statisticsKeys.readingMonthSummary({ from: "2026-03-01", to: "2026-03-31" });

    expect(matchesStatisticsKey({ queryKey })).toBe(true);
  });

  it("does not match neighbouring api families", () => {
    const foreignKeys = [
      ["/api/books", "list"],
      ["/api/books/123/reading-history"],
      ["/api/delivery/orders/statistics", {}],
      ["/api/goals", "detail", "1"],
      ["/api/series", "overview"],
      ["/api/profile/settings"],
      ["/api/statisticsx"],
      [42],
    ];

    for (const queryKey of foreignKeys) {
      expect(matchesStatisticsKey({ queryKey })).toBe(false);
    }
  });
});

describe("invalidateStatisticsQueries", () => {
  it("invalidates only the statistics family", async () => {
    const queryClient = new QueryClient();
    const statisticsKey = statisticsKeys.overview({ period: "year" });
    const booksKey = ["/api/books", "list"];

    queryClient.setQueryData(statisticsKey, { marker: "statistics" });
    queryClient.setQueryData(booksKey, { marker: "books" });

    await invalidateStatisticsQueries(queryClient);

    expect(queryClient.getQueryState(statisticsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(booksKey)?.isInvalidated).toBe(false);
  });
});
