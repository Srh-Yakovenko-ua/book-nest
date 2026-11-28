"use client";

import type { ReadingStatisticsInsightCode, ReadingStatisticsOverview } from "@app/shared";

import type { DynamicsMetric } from "../../model/statistics-dynamics";
import type { UseStatisticsViewResult } from "../../model/use-statistics-view";

import { ReadingCalendarLink } from "../reading/reading-calendar-link";
import { ReadingDynamicsCard } from "../reading/reading-dynamics-card";
import { ReadingHabitsSection } from "../reading/reading-habits-section";
import { ReadingWeekdayActivity } from "../reading/reading-weekday-activity";
import { StatisticsFocusTarget } from "../statistics-focus-target";
import { StatisticsPresenceGate } from "../statistics-presence-gate";
import { StatisticsReadingEmpty } from "../statistics-reading-empty";

const ACTIVITY_COMPARISON_INSIGHT_CODE = {
  pages: "pages_read_vs_comparison",
  reads: "completed_reads_vs_comparison",
} as const satisfies Record<DynamicsMetric, ReadingStatisticsInsightCode>;

export function StatisticsActivityTab({
  isComparisonLowerBound,
  onShowAllTime,
  overview,
  view,
}: {
  isComparisonLowerBound: boolean;
  onShowAllTime: () => void;
  overview: ReadingStatisticsOverview;
  view: UseStatisticsViewResult;
}) {
  const comparisonInsight = overview.overviewInsights[view.metric].find(
    (insight) => insight.code === ACTIVITY_COMPARISON_INSIGHT_CODE[view.metric],
  );
  const comparisonResult =
    comparisonInsight?.code === "completed_reads_vs_comparison" ||
    comparisonInsight?.code === "pages_read_vs_comparison"
      ? comparisonInsight.params
      : undefined;

  const activityBlocks = (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-20 xl:items-start">
        <StatisticsFocusTarget
          className="min-w-0 xl:col-span-11"
          isTarget={view.section === "dynamics"}
        >
          <ReadingDynamicsCard
            comparison={overview.comparison}
            comparisonResult={comparisonResult}
            dynamics={overview.dynamics}
            isComparisonLowerBound={isComparisonLowerBound}
            metric={view.metric}
            onMetricChange={view.setMetric}
            period={overview.period}
            variant="full"
          />
        </StatisticsFocusTarget>
        <StatisticsFocusTarget
          className="min-w-0 xl:col-span-9"
          isTarget={view.section === "habits"}
        >
          <ReadingHabitsSection calendar={overview.calendar} meta={overview.meta} />
        </StatisticsFocusTarget>
      </div>
      <ReadingWeekdayActivity
        calendar={overview.calendar}
        key={[overview.period.from, overview.period.to].join(":")}
        weekStartDay={overview.meta.weekStartDay}
      />
    </>
  );

  return (
    <>
      <StatisticsPresenceGate
        overview={overview}
        renderAbsent={(presence) =>
          presence.kind === "period_empty" ? (
            activityBlocks
          ) : (
            <StatisticsReadingEmpty
              onShowAllTime={onShowAllTime}
              presence={presence}
              signal="reading"
            />
          )
        }
        signal="reading"
      >
        {activityBlocks}
      </StatisticsPresenceGate>
      <ReadingCalendarLink />
    </>
  );
}
