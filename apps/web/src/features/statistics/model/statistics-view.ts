import type { ReadingStatisticsKpis } from "@app/shared";

import { parseAsStringLiteral } from "nuqs/server";

import type { DynamicsMetric } from "./statistics-dynamics";

import { DYNAMICS_METRICS } from "./statistics-dynamics";

export const STATISTICS_VIEW = {
  defaultMetric: "reads",
  defaultTab: "overview",
  sections: ["dynamics", "habits", "ratings"],
  tabs: ["overview", "activity", "tastes", "progress"],
} as const satisfies {
  defaultMetric: DynamicsMetric;
  defaultTab: string;
  sections: readonly string[];
  tabs: readonly string[];
};

export type StatisticsDestination =
  | { metric: DynamicsMetric; section: "dynamics"; tab: "activity" }
  | { section: "habits"; tab: "activity" }
  | { section: "ratings"; tab: "tastes" };

export type StatisticsKpiKey = Exclude<keyof ReadingStatisticsKpis, "uniqueBooksCompleted">;

export type StatisticsSectionAnchor = (typeof STATISTICS_VIEW.sections)[number];

export type StatisticsTab = (typeof STATISTICS_VIEW.tabs)[number];

export const STATISTICS_KPI_DESTINATIONS = {
  activeDays: { section: "habits", tab: "activity" },
  averageRating: { section: "ratings", tab: "tastes" },
  completedReads: { metric: "reads", section: "dynamics", tab: "activity" },
  pagesRead: { metric: "pages", section: "dynamics", tab: "activity" },
} as const satisfies Record<StatisticsKpiKey, StatisticsDestination>;

export const statisticsViewParsers = {
  metric: parseAsStringLiteral(DYNAMICS_METRICS).withDefault(STATISTICS_VIEW.defaultMetric),
  section: parseAsStringLiteral(STATISTICS_VIEW.sections),
  tab: parseAsStringLiteral(STATISTICS_VIEW.tabs).withDefault(STATISTICS_VIEW.defaultTab),
};

export function toStatisticsTab(value: string): StatisticsTab {
  return STATISTICS_VIEW.tabs.find((tab) => tab === value) ?? STATISTICS_VIEW.defaultTab;
}
