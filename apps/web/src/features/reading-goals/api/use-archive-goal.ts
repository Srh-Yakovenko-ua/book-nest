import type { ReadingGoalView } from "@app/shared";

import { ReadingGoalViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { readingGoalsControllerArchive } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalChangeEffects } from "./goal-change-effects";

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
      void goalChangeEffects.goalsChanged(queryClient, { change: "archived" });
    },
  });
}
