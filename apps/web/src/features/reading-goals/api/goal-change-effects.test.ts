import type { QueryKey } from "@tanstack/react-query";

import { describe, expect, it } from "vitest";

import { statisticsKeys } from "@/features/statistics/api/statistics-keys";
import { cacheStatuses, seededClient, watchedQuery } from "@/test-query-cache";

import { goalChangeEffects } from "./goal-change-effects";
import { goalKeys } from "./goal-keys";

const KEYS = {
  detail: goalKeys.detail("goal-1"),
  otherDetail: goalKeys.detail("goal-2"),
  overview: goalKeys.overview,
  statistics: statisticsKeys.overview({ year: 2026 }),
  unrelated: ["/api/notes", "x"],
} as const satisfies Record<string, QueryKey>;

describe("goalChangeEffects", () => {
  it.each(["created", "updated", "archived"] as const)(
    "refreshes the goal overview, the goal detail and statistics but not notes after a goal is %s",
    async (change) => {
      const keys = [KEYS.overview, KEYS.detail, KEYS.statistics, KEYS.unrelated];
      const client = seededClient(keys);

      await goalChangeEffects.goalsChanged(client, { change });

      expect(cacheStatuses(client, keys)).toEqual(["stale", "stale", "stale", "fresh"]);
    },
  );

  it("drops the removed goal's detail from the cache", async () => {
    const keys = [KEYS.detail];
    const client = seededClient(keys);

    await goalChangeEffects.goalRemoved(client, "goal-1");

    expect(cacheStatuses(client, keys)).toEqual(["removed"]);
  });

  it("retires the watched detail of a removed goal without refetching it", async () => {
    const client = seededClient([KEYS.overview]);
    const watched = await watchedQuery(client, KEYS.detail);

    await goalChangeEffects.goalRemoved(client, "goal-1");
    watched.unsubscribe();

    expect(watched.queryFn).toHaveBeenCalledTimes(1);
    expect(cacheStatuses(client, [KEYS.overview])).toEqual(["stale"]);
  });

  it("refreshes other goals, the overview and statistics after a goal is removed", async () => {
    const keys = [KEYS.otherDetail, KEYS.overview, KEYS.statistics];
    const client = seededClient(keys);

    await goalChangeEffects.goalRemoved(client, "goal-1");

    expect(cacheStatuses(client, keys)).toEqual(["stale", "stale", "stale"]);
  });
});
