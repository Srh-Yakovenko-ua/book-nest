import type { QueryClient } from "@tanstack/react-query";

import type { QueryKeyMatcher } from "@/lib/query-keys";

import { matchesStatisticsKey } from "@/features/statistics/api/statistics-keys";
import { matchesAnyKeyPrefix, matchesApiRoot, retireQueries } from "@/lib/query-keys";

import { goalKeys } from "./goal-keys";

const GOAL_KEY_FAMILIES = {
  goals: matchesAnyKeyPrefix(goalKeys.root),
  home: matchesApiRoot("/api/home"),
  statistics: matchesStatisticsKey,
} as const satisfies Record<string, QueryKeyMatcher>;

type GoalKeyFamily = keyof typeof GOAL_KEY_FAMILIES;

const GOAL_CHANGE_EFFECTS = {
  archived: ["goals", "statistics", "home"],
  created: ["goals", "statistics", "home"],
  deleted: ["goals", "statistics", "home"],
  updated: ["goals", "statistics", "home"],
} as const satisfies Record<string, readonly GoalKeyFamily[]>;

type GoalChange = keyof typeof GOAL_CHANGE_EFFECTS;

function goalRemoved(queryClient: QueryClient, goalId: string): Promise<void> {
  const deletedViews = matchesAnyKeyPrefix(goalKeys.scope(goalId));
  retireQueries(queryClient, deletedViews);

  return goalsChanged(queryClient, { change: "deleted", keep: [deletedViews] });
}

function goalsChanged(
  queryClient: QueryClient,
  { change, keep = [] }: { change: GoalChange; keep?: readonly QueryKeyMatcher[] },
): Promise<void> {
  const families: readonly GoalKeyFamily[] = GOAL_CHANGE_EFFECTS[change];
  const matchers: QueryKeyMatcher[] = families.map((family) => GOAL_KEY_FAMILIES[family]);

  return queryClient.invalidateQueries({
    predicate: (query) =>
      matchers.some((matches) => matches(query)) && !keep.some((kept) => kept(query)),
  });
}

export const goalChangeEffects = { goalRemoved, goalsChanged };
