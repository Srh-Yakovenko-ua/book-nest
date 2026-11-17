"use client";

import type { ReadingStatisticsActivityPage } from "@app/shared";

import { ReadingStatisticsActivityPageSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { statisticsControllerGetReadingActivity } from "@/shared/api/generated/endpoints/statistics/statistics";

import { statisticsKeys } from "./statistics-keys";

export function useReadingMonthBooks({
  enabled,
  from,
  to,
}: {
  enabled: boolean;
  from: string;
  to: string;
}) {
  return useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<ReadingStatisticsActivityPage> =>
      ReadingStatisticsActivityPageSchema.parse(
        await statisticsControllerGetReadingActivity({ from, limit: 1, to }, { signal }),
      ),
    queryKey: statisticsKeys.readingMonthSummary({ from, to }),
  });
}
