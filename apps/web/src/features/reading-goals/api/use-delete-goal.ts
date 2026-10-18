import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { readingGoalsControllerDelete } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys, invalidateGoalQueries } from "./goal-keys";

type DeleteGoalVariables = {
  goalId: string;
};

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId }: DeleteGoalVariables): Promise<void> => {
      await readingGoalsControllerDelete(goalId);
    },
    onSuccess: (_result, { goalId }) => {
      queryClient.removeQueries({ queryKey: goalKeys.scope(goalId) });
      void invalidateGoalQueries(queryClient);
      void invalidateStatisticsQueries(queryClient);
    },
  });
}
