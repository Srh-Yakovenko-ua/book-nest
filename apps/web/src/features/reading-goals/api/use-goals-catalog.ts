import type { ReadingGoalListResponse } from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";

import { ReadingGoalListResponseSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { readingGoalsControllerList } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import type { GoalsListParams } from "../model/goals-query";

import { goalKeys } from "./goal-keys";

export function useGoalsCatalog(params: GoalsListParams) {
  return useInfiniteQuery<
    ReadingGoalListResponse,
    Error,
    InfiniteData<ReadingGoalListResponse>,
    ReturnType<typeof goalKeys.catalog>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      ReadingGoalListResponseSchema.parse(
        await readingGoalsControllerList({ ...params, cursor: pageParam }),
      ),
    queryKey: goalKeys.catalog(params),
  });
}
