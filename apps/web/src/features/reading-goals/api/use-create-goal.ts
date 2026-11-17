import type { CreateReadingGoalInput, ReadingGoalView } from "@app/shared";

import { ReadingGoalViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";
import { readingGoalsControllerCreate } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalChangeEffects } from "./goal-change-effects";
import { invalidateGoalQueries } from "./goal-keys";

type CreateGoalVariables = {
  input: CreateReadingGoalInput;
  listId: string;
};

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, listId }: CreateGoalVariables): Promise<ReadingGoalView> => {
      const response = await readingGoalsControllerCreate(listId, input);
      return ReadingGoalViewSchema.parse(response);
    },
    onError: (error) => {
      if (!isApiErrorStatus(error, HTTP_STATUS.conflict)) return;
      void invalidateGoalQueries(queryClient);
    },
    onSuccess: () => {
      void goalChangeEffects.goalsChanged(queryClient, { change: "created" });
    },
  });
}
