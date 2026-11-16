import { useMutation, useQueryClient } from "@tanstack/react-query";

import { readingGoalsControllerDelete } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalChangeEffects } from "./goal-change-effects";

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
      void goalChangeEffects.goalRemoved(queryClient, goalId);
    },
  });
}
