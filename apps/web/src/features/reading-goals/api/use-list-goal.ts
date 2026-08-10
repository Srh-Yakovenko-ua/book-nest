import type { Nullable, ReadingGoalView } from "@app/shared";

import { ReadingGoalViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { readingGoalsControllerFindByList } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys } from "./goal-keys";

const ListGoalSchema = ReadingGoalViewSchema.nullable();

export function useListGoal(listId: string) {
  return useQuery({
    queryFn: async (): Promise<Nullable<ReadingGoalView>> => {
      const response: unknown = await readingGoalsControllerFindByList(listId);
      return ListGoalSchema.parse(response ?? null);
    },
    queryKey: goalKeys.forList(listId),
    retry: false,
  });
}
