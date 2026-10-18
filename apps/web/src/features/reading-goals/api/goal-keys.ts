import type { QueryClient } from "@tanstack/react-query";

import type {
  ReadingGoalsControllerListActivityParams,
  ReadingGoalsControllerListBooksParams,
  ReadingGoalsControllerListParams,
} from "@/shared/api/generated/model";

const GOALS_ROOT = "/api/goals";
const GOALS_CATALOG_INDEX = [GOALS_ROOT, "catalog"] as const;

export const goalKeys = {
  activity: (goalId: string, params: Omit<ReadingGoalsControllerListActivityParams, "cursor">) =>
    [...goalScope(goalId), "activity", params] as const,
  books: (goalId: string, params: Omit<ReadingGoalsControllerListBooksParams, "cursor">) =>
    [...goalScope(goalId), "books", params] as const,
  catalog: (params: Omit<ReadingGoalsControllerListParams, "cursor">) =>
    [...GOALS_CATALOG_INDEX, params] as const,
  detail: (goalId: string) => [...goalScope(goalId), "detail"] as const,
  forList: (listId: string) => [GOALS_ROOT, "for-list", listId] as const,
  overview: [GOALS_ROOT, "overview"] as const,
  root: [GOALS_ROOT] as const,
  scope: goalScope,
};

export function invalidateGoalQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: goalKeys.root });
}

function goalScope(goalId: string) {
  return [GOALS_ROOT, "goal", goalId] as const;
}
