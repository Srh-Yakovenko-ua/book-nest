"use client";

import type { ReadingStatisticsOverview } from "@app/shared";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { UseStatisticsViewResult } from "../../model/use-statistics-view";

import { isPeriodIncludingDay } from "../../model/statistics-period";
import { ReadingGoalCard } from "../progress/reading-goal-card";
import { ReadingDynamicsCard } from "../reading/reading-dynamics-card";
import { StatisticsPresenceGate } from "../statistics-presence-gate";
import { StatisticsReadingEmpty } from "../statistics-reading-empty";
import { StatisticsInsights } from "./statistics-insights";
import { StatisticsKpiGrid } from "./statistics-kpi-grid";
import { StatisticsRecentReads } from "./statistics-recent-reads";

const OVERVIEW_LAYOUT = {
  row: "grid grid-cols-1 items-start gap-6 xl:grid-cols-3",
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
  const includesToday = isPeriodIncludingDay({ day: today, period: overview.period });
  const currentGoal = includesToday ? (
    <ReadingGoalCard goal={overview.goal} variant="compact" />
  ) : null;
  const activeGoal = overview.goal.primaryGoal === null ? null : currentGoal;

  return (
    <StatisticsPresenceGate
      overview={overview}
      renderAbsent={(presence) => (
        <>
          <StatisticsReadingEmpty
            onShowAllTime={onShowAllTime}
            presence={presence}
            signal="reading"
          />
          {activeGoal}
        </>
      )}
      signal="reading"
    >
      <ActiveOverview
        currentGoal={currentGoal}
        isComparisonLowerBound={isComparisonLowerBound}
        isLowerBound={isLowerBound}
        overview={overview}
        view={view}
      />
    </StatisticsPresenceGate>
  );
}

function ActiveOverview({
  currentGoal,
  isComparisonLowerBound,
  isLowerBound,
  overview,
  view,
}: {
  currentGoal: ReactNode;
  isComparisonLowerBound: boolean;
  isLowerBound: boolean;
  overview: ReadingStatisticsOverview;
  view: UseStatisticsViewResult;
}) {
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
