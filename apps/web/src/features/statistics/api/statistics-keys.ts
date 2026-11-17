import type {
  StatisticsControllerGetCalendarPageParams,
  StatisticsControllerGetCompletedReadsParams,
  StatisticsControllerGetCompletedReadsSubsetParams,
  StatisticsControllerGetOverviewParams,
  StatisticsControllerGetReadingActivityParams,
} from "@/shared/api/generated/model";

import { matchesApiRoot } from "@/lib/query-keys";

const STATISTICS_ROOT = "/api/statistics";

export const statisticsKeys = {
  calendarPage: (params: StatisticsControllerGetCalendarPageParams) =>
    [`${STATISTICS_ROOT}/calendar`, params] as const,
  completedReads: (params: StatisticsControllerGetCompletedReadsParams) =>
    [`${STATISTICS_ROOT}/completed-reads`, params] as const,
  completedReadsSubset: (params: StatisticsControllerGetCompletedReadsSubsetParams) =>
    [`${STATISTICS_ROOT}/completed-reads/subset`, params] as const,
  overview: (params: StatisticsControllerGetOverviewParams) =>
    [`${STATISTICS_ROOT}/overview`, params] as const,
  readingActivity: (params: StatisticsControllerGetReadingActivityParams) =>
    [`${STATISTICS_ROOT}/reading-activity`, params] as const,
  readingDay: (date: string) => [`${STATISTICS_ROOT}/reading-days/${date}`] as const,
  readingMonthSummary: (
    params: Pick<StatisticsControllerGetReadingActivityParams, "from" | "to">,
  ) => [`${STATISTICS_ROOT}/reading-month-summary`, params] as const,
};

export const matchesStatisticsKey = matchesApiRoot(STATISTICS_ROOT);
