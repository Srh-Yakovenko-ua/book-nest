"use client";

import type {
  ReadingStatisticsActivityPage,
  ReadingStatisticsCompletedReadsPage,
  ReadingStatisticsDateRange,
} from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";

import {
  ReadingStatisticsActivityPageSchema,
  ReadingStatisticsCompletedReadsPageSchema,
} from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import {
  statisticsControllerGetCompletedReads,
  statisticsControllerGetReadingActivity,
} from "@/shared/api/generated/endpoints/statistics/statistics";

import { statisticsKeys } from "./statistics-keys";

type CompletedReadsKey = ReturnType<typeof statisticsKeys.completedReads>;

type ReadingActivityKey = ReturnType<typeof statisticsKeys.readingActivity>;

export function useCompletedReadsInterval(range: ReadingStatisticsDateRange) {
  return useInfiniteQuery<
    ReadingStatisticsCompletedReadsPage,
    Error,
    InfiniteData<ReadingStatisticsCompletedReadsPage>,
    CompletedReadsKey,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      ReadingStatisticsCompletedReadsPageSchema.parse(
        await statisticsControllerGetCompletedReads({ ...range, cursor: pageParam }),
      ),
    queryKey: statisticsKeys.completedReads(range),
  });
}

export function useReadingActivityInterval(range: ReadingStatisticsDateRange) {
  return useInfiniteQuery<
    ReadingStatisticsActivityPage,
    Error,
    InfiniteData<ReadingStatisticsActivityPage>,
    ReadingActivityKey,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      ReadingStatisticsActivityPageSchema.parse(
        await statisticsControllerGetReadingActivity({ ...range, cursor: pageParam }),
      ),
    queryKey: statisticsKeys.readingActivity(range),
  });
}
