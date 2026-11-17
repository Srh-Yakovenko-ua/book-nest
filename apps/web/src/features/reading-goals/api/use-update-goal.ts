import type { ReadingGoalView, UpdateReadingGoalInput } from "@app/shared";

import { ReadingGoalViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { readingGoalsControllerUpdate } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalChangeEffects } from "./goal-change-effects";

type UpdateGoalVariables = {
  goalId: string;
  input: UpdateReadingGoalInput;
};

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, input }: UpdateGoalVariables): Promise<ReadingGoalView> => {
      const response = await readingGoalsControllerUpdate(goalId, input);
      return ReadingGoalViewSchema.parse(response);
    },
    onSuccess: () => {
      void goalChangeEffects.goalsChanged(queryClient, { change: "updated" });
    },
  });
}
