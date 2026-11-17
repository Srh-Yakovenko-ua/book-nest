"use client";

import type { ReadingStatisticsCalendarPage } from "@app/shared";

import { ReadingStatisticsCalendarPageSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { StatisticsControllerGetCalendarPageParams } from "@/shared/api/generated/model";

import { statisticsControllerGetCalendarPage } from "@/shared/api/generated/endpoints/statistics/statistics";

import { statisticsKeys } from "./statistics-keys";

export function useReadingCalendarPage(params: StatisticsControllerGetCalendarPageParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ReadingStatisticsCalendarPage> =>
      ReadingStatisticsCalendarPageSchema.parse(await statisticsControllerGetCalendarPage(params)),
    queryKey: statisticsKeys.calendarPage(params),
  });
}
