import type { ReadingGoalView } from "@app/shared";

import { ReadingGoalViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { readingGoalsControllerArchive } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { invalidateGoalQueries } from "./goal-keys";

type ArchiveGoalVariables = {
  goalId: string;
};

export function useArchiveGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId }: ArchiveGoalVariables): Promise<ReadingGoalView> => {
      const response = await readingGoalsControllerArchive(goalId);
      return ReadingGoalViewSchema.parse(response);
    },
    onSuccess: () => {
      void invalidateGoalQueries(queryClient);
      void invalidateStatisticsQueries(queryClient);
    },
  });
}
