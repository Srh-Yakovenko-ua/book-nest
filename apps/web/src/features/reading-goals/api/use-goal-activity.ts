import type { Nullable, ReadingGoalActivityResponse } from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";

import { READING_GOAL_PAGE_SIZE, ReadingGoalActivityResponseSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { readingGoalsControllerListActivity } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import type { GoalActivityType } from "../model/goal-detail-query";

import { goalKeys } from "./goal-keys";

type UseGoalActivityParams = {
  activityType: Nullable<GoalActivityType>;
  goalId: string;
};

export function useGoalActivity({ activityType, goalId }: UseGoalActivityParams) {
  const limit = READING_GOAL_PAGE_SIZE.default;
  const params = activityType === null ? { limit } : { limit, type: activityType };

  return useInfiniteQuery<
    ReadingGoalActivityResponse,
    Error,
    InfiniteData<ReadingGoalActivityResponse>,
    ReturnType<typeof goalKeys.activity>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      ReadingGoalActivityResponseSchema.parse(
        await readingGoalsControllerListActivity(goalId, { ...params, cursor: pageParam }),
      ),
    queryKey: goalKeys.activity(goalId, params),
  });
}
