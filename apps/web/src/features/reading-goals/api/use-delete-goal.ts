import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateStatisticsQueries } from "@/features/statistics/api/statistics-keys";
import { matchesAnyKeyPrefix, retireQueries } from "@/lib/query-keys";
import { readingGoalsControllerDelete } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys } from "./goal-keys";

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
      const deletedGoalViews = matchesAnyKeyPrefix(goalKeys.scope(goalId));
      retireQueries(queryClient, deletedGoalViews);
      void queryClient.invalidateQueries({
        predicate: (query) => !deletedGoalViews(query),
        queryKey: goalKeys.root,
      });
      void invalidateStatisticsQueries(queryClient);
    },
  });
}
