"use client";

import type { Nullable } from "@app/shared";

import { createSerializer, useQueryStates } from "nuqs";

import type { DynamicsMetric } from "./statistics-dynamics";
import type { StatisticsQueryState } from "./statistics-period";
import type {
  CalendarMode,
  StatisticsDestination,
  StatisticsSectionAnchor,
  StatisticsTab,
} from "./statistics-view";

import { statisticsParsers } from "./statistics-period";
import { statisticsViewParsers } from "./statistics-view";

export type UseStatisticsViewResult = {
  calendarMode: CalendarMode;
  calendarMonth: Nullable<string>;
  destinationHref: (destination: StatisticsDestination) => string;
  metric: DynamicsMetric;
  open: (destination: StatisticsDestination) => void;
  section: Nullable<StatisticsSectionAnchor>;
  setCalendarMode: (mode: CalendarMode) => void;
  setCalendarMonth: (month: Nullable<string>) => void;
  setMetric: (metric: DynamicsMetric) => void;
  setTab: (tab: StatisticsTab) => void;
  tab: StatisticsTab;
};

const STATISTICS_PATH = "/statistics";

const serializeStatisticsUrl = createSerializer({
  ...statisticsParsers,
  ...statisticsViewParsers,
});

export function useStatisticsView(periodState: StatisticsQueryState): UseStatisticsViewResult {
  const [view, setView] = useQueryStates(statisticsViewParsers, { history: "push" });

  return {
    calendarMode: view.calendarMode,
    calendarMonth: view.calendarMonth,
    destinationHref: (destination) =>
      serializeStatisticsUrl(STATISTICS_PATH, {
        ...periodState,
        metric: view.metric,
        ...destination,
      }),
    metric: view.metric,
    open: (destination) => void setView(destination),
    section: view.section,
    setCalendarMode: (calendarMode) => void setView({ calendarMode }, { history: "replace" }),
    setCalendarMonth: (calendarMonth) => void setView({ calendarMonth }, { history: "replace" }),
    setMetric: (metric) => void setView({ metric }, { history: "replace" }),
    setTab: (tab) => void setView({ section: null, tab }),
    tab: view.tab,
  };
}
