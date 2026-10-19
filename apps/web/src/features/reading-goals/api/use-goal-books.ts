import type { ReadingGoalBooksResponse } from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";

import { READING_GOAL_PAGE_SIZE, ReadingGoalBooksResponseSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { readingGoalsControllerListBooks } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import type { GoalBooksScope } from "../model/goal-detail-query";

import { goalKeys } from "./goal-keys";

type UseGoalBooksParams = {
  goalId: string;
  scope: GoalBooksScope;
};

export function useGoalBooks({ goalId, scope }: UseGoalBooksParams) {
  const params = { limit: READING_GOAL_PAGE_SIZE.default, scope };

  return useInfiniteQuery<
    ReadingGoalBooksResponse,
    Error,
    InfiniteData<ReadingGoalBooksResponse>,
    ReturnType<typeof goalKeys.books>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      ReadingGoalBooksResponseSchema.parse(
        await readingGoalsControllerListBooks(goalId, { ...params, cursor: pageParam }),
      ),
    queryKey: goalKeys.books(goalId, params),
  });
}
