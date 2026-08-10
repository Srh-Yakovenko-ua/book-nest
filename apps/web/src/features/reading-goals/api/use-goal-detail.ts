import type { ReadingGoalDetail } from "@app/shared";

import { ReadingGoalDetailSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { readingGoalsControllerFindOne } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys } from "./goal-keys";

export function useGoalDetail(goalId: string) {
  return useQuery({
    queryFn: async (): Promise<ReadingGoalDetail> => {
      const response = await readingGoalsControllerFindOne(goalId);
      return ReadingGoalDetailSchema.parse(response);
    },
    queryKey: goalKeys.detail(goalId),
    retry: false,
  });
}
