import type { ReadingGoalCreationPreview } from "@app/shared";

import { ReadingGoalCreationPreviewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { readingGoalsControllerPreviewCreation } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { toCreationPreviewQuery } from "../model/goal-form";
import { goalKeys } from "./goal-keys";

type UseGoalCreationPreviewParams = {
  deadline: string;
  listId: string;
  today: string;
};

export function useGoalCreationPreview({ deadline, listId, today }: UseGoalCreationPreviewParams) {
  const query = toCreationPreviewQuery({ deadline, today });

  return useQuery({
    queryFn: async (): Promise<ReadingGoalCreationPreview> =>
      ReadingGoalCreationPreviewSchema.parse(
        await readingGoalsControllerPreviewCreation(listId, query),
      ),
    queryKey: goalKeys.creationPreview(listId, query),
    staleTime: 0,
  });
}
