"use client";

import type { Nullable } from "@app/shared";

import { createSerializer, useQueryStates } from "nuqs";

import type { DynamicsMetric } from "./statistics-dynamics";
import type { StatisticsQueryState } from "./statistics-period";
import type {
  StatisticsDestination,
  StatisticsSectionAnchor,
  StatisticsTab,
} from "./statistics-view";

import { statisticsParsers } from "./statistics-period";
import { statisticsViewParsers } from "./statistics-view";

export type UseStatisticsViewResult = {
  destinationHref: (destination: StatisticsDestination) => string;
  metric: DynamicsMetric;
  open: (destination: StatisticsDestination) => void;
  section: Nullable<StatisticsSectionAnchor>;
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
    destinationHref: (destination) =>
      serializeStatisticsUrl(STATISTICS_PATH, {
        ...periodState,
        metric: view.metric,
        ...destination,
      }),
    metric: view.metric,
    open: (destination) => void setView(destination),
    section: view.section,
    setMetric: (metric) => void setView({ metric }, { history: "replace" }),
    setTab: (tab) => void setView({ section: null, tab }),
    tab: view.tab,
  };
}
