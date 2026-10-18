import type { ReadingGoalsOverview } from "@app/shared";

import { ReadingGoalsOverviewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { readingGoalsControllerOverview } from "@/shared/api/generated/endpoints/reading-goals/reading-goals";

import { goalKeys } from "./goal-keys";

export function useGoalsOverview() {
  return useQuery({
    queryFn: async (): Promise<ReadingGoalsOverview> =>
      ReadingGoalsOverviewSchema.parse(await readingGoalsControllerOverview()),
    queryKey: goalKeys.overview,
  });
}
