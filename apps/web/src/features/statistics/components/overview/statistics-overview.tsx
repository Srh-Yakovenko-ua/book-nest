"use client";

import type { ReadingStatisticsInsightCode, ReadingStatisticsOverview } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { TitleLeaf } from "@/components/title-leaf";
import { cn } from "@/lib/utils";

import type { DynamicsMetric } from "../../model/statistics-dynamics";
import type { StatisticsScopeState } from "../../model/statistics-scope-state";
import type { UseStatisticsParamsResult } from "../../model/use-statistics-params";

import { useReadingStatisticsOverview } from "../../api/use-reading-statistics-overview";
import { isLowerBoundComparison } from "../../model/statistics-dynamics";
import { toStatisticsScopeState } from "../../model/statistics-scope-state";
import { STATISTICS_VIEW, toStatisticsTab } from "../../model/statistics-view";
import { useStatisticsParams } from "../../model/use-statistics-params";
import { useStatisticsView } from "../../model/use-statistics-view";
import { StatisticsPeriodControls } from "../controls/statistics-period-controls";
import { LibraryBalanceSection } from "../progress/library-balance-section";
import { ReadingGoalCard } from "../progress/reading-goal-card";
import { RecordsSection } from "../progress/records-section";
import { SeriesSection } from "../progress/series-section";
import { ReadingCalendarCard } from "../reading/reading-calendar-card";
import { ReadingDynamicsCard } from "../reading/reading-dynamics-card";
import { ReadingHabitsSection } from "../reading/reading-habits-section";
import { ReadingWeekdayActivity } from "../reading/reading-weekday-activity";
import { StatisticsFocusTarget } from "../statistics-focus-target";
import {
  StatisticsError,
  StatisticsNote,
  StatisticsRefetchError,
  StatisticsRefreshingNote,
  StatisticsSectionState,
  StatisticsSkeleton,
} from "../statistics-states";
import { AuthorsSection } from "../tastes/authors-section";
import { DiscoveriesSection } from "../tastes/discoveries-section";
import { GenresSection } from "../tastes/genres-section";
import { LanguagesSection } from "../tastes/languages-section";
import { PublishersSection } from "../tastes/publishers-section";
import { RatingsSection } from "../tastes/ratings-section";
import { StatisticsOverviewTab } from "./statistics-overview-tab";

const ACTIVITY_COMPARISON_INSIGHT_CODE = {
  pages: "pages_read_vs_comparison",
  reads: "completed_reads_vs_comparison",
} as const satisfies Record<DynamicsMetric, ReadingStatisticsInsightCode>;

export function StatisticsOverview() {
  const t = useTranslations("statistics");
  const params = useStatisticsParams();
  const query = useReadingStatisticsOverview(params.queryParams, {
    enabled: params.isRequestable,
  });
  const scope = toStatisticsScopeState(query);
  const currentOverview = scope.isPlaceholderData ? undefined : scope.data;
  const periodTriggerRef = useRef<HTMLButtonElement>(null);

  const showAllTime = () => {
    periodTriggerRef.current?.focus();
    params.setPeriod("all_time");
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <StatisticsPeriodControls
        comparison={currentOverview?.comparison ?? null}
        params={params}
        period={currentOverview?.period ?? null}
        periodTriggerRef={periodTriggerRef}
      />

      {scope.isPlaceholderData ? (
        <StatisticsRefreshingNote reason="periodChange" />
      ) : scope.isRefreshing ? (
        <StatisticsRefreshingNote />
      ) : null}
      {scope.isRefetchError ? <StatisticsRefetchError onRetry={scope.retry} /> : null}

      <StatisticsBody onShowAllTime={showAllTime} params={params} scope={scope} />
    </div>
  );
}

function StatisticsBody({
  onShowAllTime,
  params,
  scope,
}: {
  onShowAllTime: () => void;
  params: UseStatisticsParamsResult;
  scope: StatisticsScopeState<ReadingStatisticsOverview>;
}) {
  const t = useTranslations("statistics");
  const overview = scope.data;

  if (scope.isInitialError) {
    return <StatisticsError onRetry={scope.retry} />;
  }

  if (overview === undefined) {
    return params.isRequestable ? (
      <StatisticsSkeleton />
    ) : (
      <StatisticsSectionState
        description={t("states.invalidRange.description")}
        kind="insufficient"
        title={t("states.invalidRange.title")}
      />
    );
  }

  const isLowerBound = overview.meta.activityHistory.selectedPeriodQuality === "legacy_lower_bound";

  return (
    <div
      aria-busy={scope.isRefreshing}
      className={cn(
        "flex flex-col gap-6 motion-safe:transition-opacity",
        scope.isPlaceholderData && "opacity-60",
      )}
      inert={scope.isPlaceholderData}
    >
      {isLowerBound ? <StatisticsNote>{t("states.lowerBound")}</StatisticsNote> : null}

      <StatisticsTabs
        isLowerBound={isLowerBound}
        isPlaceholderData={scope.isPlaceholderData}
        onShowAllTime={onShowAllTime}
        overview={overview}
        params={params}
      />
    </div>
  );
}

function StatisticsTabs({
  isLowerBound,
  isPlaceholderData,
  onShowAllTime,
  overview,
  params,
}: {
  isLowerBound: boolean;
  isPlaceholderData: boolean;
  onShowAllTime: () => void;
  overview: ReadingStatisticsOverview;
  params: UseStatisticsParamsResult;
}) {
  const t = useTranslations("statistics.tabs");
  const view = useStatisticsView(params.state);
  const isComparisonLowerBound = isLowerBoundComparison({
    comparison: overview.comparison,
    reliableFrom: overview.meta.activityHistory.reliableFrom,
  });
  const comparisonInsight = overview.overviewInsights[view.metric].find(
    (insight) => insight.code === ACTIVITY_COMPARISON_INSIGHT_CODE[view.metric],
  );
  const comparisonResult =
    comparisonInsight?.code === "completed_reads_vs_comparison" ||
    comparisonInsight?.code === "pages_read_vs_comparison"
      ? comparisonInsight.params
      : undefined;

  const items: PageTabsItem[] = STATISTICS_VIEW.tabs.map((value) => ({ label: t(value), value }));

  return (
    <PageTabs
      ariaLabel={t("label")}
      items={items}
      onValueChange={(value) => view.setTab(toStatisticsTab(value))}
      value={view.tab}
    >
      <PageTabsPanel className="flex flex-col gap-6" value="overview">
        <StatisticsOverviewTab
          isComparisonLowerBound={isComparisonLowerBound}
          isLowerBound={isLowerBound}
          onShowAllTime={onShowAllTime}
          overview={overview}
          today={params.today}
          view={view}
        />
      </PageTabsPanel>

      <PageTabsPanel className="flex flex-col gap-6" value="activity">
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
        <StatisticsFocusTarget isTarget={view.section === "calendar"}>
          <ReadingCalendarCard
            calendar={overview.calendar}
            meta={overview.meta}
            mode={view.calendarMode}
            month={view.calendarMonth}
            onModeChange={view.setCalendarMode}
            onMonthChange={view.setCalendarMonth}
            suspendMonthNormalization={isPlaceholderData}
          />
        </StatisticsFocusTarget>
      </PageTabsPanel>

      <PageTabsPanel className="flex flex-col gap-6" value="tastes">
        <StatisticsFocusTarget isTarget={view.section === "ratings"}>
          <RatingsSection ratings={overview.ratings} />
        </StatisticsFocusTarget>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <GenresSection genres={overview.genres} />
          <AuthorsSection authors={overview.authors} />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <PublishersSection publishers={overview.publishers} />
          <LanguagesSection languages={overview.languages} />
        </div>

        {overview.period.kind === "all_time" ? null : (
          <DiscoveriesSection discoveries={overview.discoveries} />
        )}
      </PageTabsPanel>

      <PageTabsPanel className="flex flex-col gap-6" value="progress">
        <ReadingGoalCard goal={overview.goal} variant="full" />
        <SeriesSection series={overview.series} />
        <LibraryBalanceSection libraryBalance={overview.libraryBalance} />
        <RecordsSection isLowerBound={isLowerBound} records={overview.records} />
      </PageTabsPanel>
    </PageTabs>
  );
}
