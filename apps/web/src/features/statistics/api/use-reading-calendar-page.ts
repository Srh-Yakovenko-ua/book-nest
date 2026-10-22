"use client";

import type { ReadingStatisticsCalendarPage } from "@app/shared";

import { ReadingStatisticsCalendarPageSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { StatisticsControllerGetCalendarPageParams } from "@/shared/api/generated/model";

import {
  getStatisticsControllerGetCalendarPageQueryKey,
  statisticsControllerGetCalendarPage,
} from "@/shared/api/generated/endpoints/statistics/statistics";

export function useReadingCalendarPage(params: StatisticsControllerGetCalendarPageParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ReadingStatisticsCalendarPage> =>
      ReadingStatisticsCalendarPageSchema.parse(await statisticsControllerGetCalendarPage(params)),
    queryKey: getStatisticsControllerGetCalendarPageQueryKey(params),
  });
}
