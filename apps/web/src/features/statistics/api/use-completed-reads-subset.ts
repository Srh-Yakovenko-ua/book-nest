"use client";

import type {
  ReadingStatisticsCompletedReadsSubsetPage,
  ReadingStatisticsDrilldown,
  ReadingStatisticsSubsetFilter,
} from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";

import { ReadingStatisticsCompletedReadsSubsetPageSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { StatisticsControllerGetCompletedReadsSubsetParams } from "@/shared/api/generated/model";

import {
  getStatisticsControllerGetCompletedReadsSubsetQueryKey,
  statisticsControllerGetCompletedReadsSubset,
} from "@/shared/api/generated/endpoints/statistics/statistics";

export type CompletedReadsSubset = {
  filter: ReadingStatisticsSubsetFilter;
  period: Extract<ReadingStatisticsDrilldown, { kind: "completed_reads_subset" }>["period"];
};

type CompletedReadsSubsetKey = ReturnType<
  typeof getStatisticsControllerGetCompletedReadsSubsetQueryKey
>;

type SubsetFilterParams = Pick<
  StatisticsControllerGetCompletedReadsSubsetParams,
  "authorId" | "genre" | "language" | "publisherId"
>;

const COMPLETED_READS_SUBSET_PAGE_SIZE = 20;

export function useCompletedReadsSubset(subset: CompletedReadsSubset) {
  const params = toSubsetParams(subset);

  return useInfiniteQuery<
    ReadingStatisticsCompletedReadsSubsetPage,
    Error,
    InfiniteData<ReadingStatisticsCompletedReadsSubsetPage>,
    CompletedReadsSubsetKey,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      ReadingStatisticsCompletedReadsSubsetPageSchema.parse(
        await statisticsControllerGetCompletedReadsSubset({ ...params, cursor: pageParam }),
      ),
    queryKey: getStatisticsControllerGetCompletedReadsSubsetQueryKey(params),
  });
}

function toSubsetFilterParams(filter: ReadingStatisticsSubsetFilter): SubsetFilterParams {
  switch (filter.field) {
    case "authorId":
      return { authorId: filter.value };
    case "genre":
      return { genre: filter.value };
    case "language":
      return { language: filter.value };
    case "publisherId":
      return { publisherId: filter.value };
  }
}

function toSubsetParams({
  filter,
  period,
}: CompletedReadsSubset): StatisticsControllerGetCompletedReadsSubsetParams {
  return {
    ...toSubsetFilterParams(filter),
    ...(period.from === null ? {} : { periodFrom: period.from }),
    limit: COMPLETED_READS_SUBSET_PAGE_SIZE,
    periodTo: period.to,
  };
}
