"use client";

import type { ReadingStatisticsOverview } from "@app/shared";

import { cn } from "@/lib/utils";

import type { UseStatisticsViewResult } from "../../model/use-statistics-view";

import { isPeriodIncludingDay } from "../../model/statistics-period";
import { ReadingGoalCard } from "../progress/reading-goal-card";
import { ReadingDynamicsCard } from "../reading/reading-dynamics-card";
import { StatisticsPeriodEmpty } from "../statistics-states";
import { StatisticsInsights } from "./statistics-insights";
import { StatisticsKpiGrid } from "./statistics-kpi-grid";
import { StatisticsRecentReads } from "./statistics-recent-reads";

const OVERVIEW_LAYOUT = {
  row: "grid grid-cols-1 items-start gap-4 xl:grid-cols-3",
  whole: "xl:col-span-3",
  wide: "xl:col-span-2",
} as const;

export function StatisticsOverviewTab({
  isComparisonLowerBound,
  isLowerBound,
  onShowAllTime,
  overview,
  today,
  view,
}: {
  isComparisonLowerBound: boolean;
  isLowerBound: boolean;
  onShowAllTime: () => void;
  overview: ReadingStatisticsOverview;
  today: string;
  view: UseStatisticsViewResult;
}) {
  const currentGoal = isPeriodIncludingDay({ day: today, period: overview.period }) ? (
    <ReadingGoalCard goal={overview.goal} variant="compact" />
  ) : null;

  if (!hasReadingActivity(overview)) {
    return (
      <>
        <StatisticsPeriodEmpty onShowAllTime={onShowAllTime} />
        {currentGoal}
      </>
    );
  }

  const insights = overview.overviewInsights[view.metric];

  return (
    <>
      <StatisticsKpiGrid
        destinationHref={view.destinationHref}
        isLowerBound={isLowerBound}
        kpis={overview.kpis}
        onOpen={view.open}
      />

      <div className={OVERVIEW_LAYOUT.row}>
        <div className={cn(insights.length === 0 ? OVERVIEW_LAYOUT.whole : OVERVIEW_LAYOUT.wide)}>
          <ReadingDynamicsCard
            comparison={overview.comparison}
            dynamics={overview.dynamics}
            isComparisonLowerBound={isComparisonLowerBound}
            metric={view.metric}
            onMetricChange={view.setMetric}
            period={overview.period}
            variant="compact"
          />
        </div>
        <StatisticsInsights insights={insights} isLowerBound={isLowerBound} />
      </div>

      <div className={OVERVIEW_LAYOUT.row}>
        <div className={cn(currentGoal === null ? OVERVIEW_LAYOUT.whole : OVERVIEW_LAYOUT.wide)}>
          <StatisticsRecentReads reads={overview.hero.recentCompletedReads} />
        </div>
        {currentGoal}
      </div>
    </>
  );
}

function hasReadingActivity(overview: ReadingStatisticsOverview): boolean {
  return (
    overview.kpis.completedReads.value > 0 ||
    (overview.kpis.pagesRead.value ?? 0) > 0 ||
    overview.calendar.activeDays > 0
  );
}
