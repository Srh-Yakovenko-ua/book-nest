"use client";

import type { ReadingStatisticsOverview } from "@app/shared";
import type { Ref } from "react";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { RefetchErrorBanner } from "@/components/refetch-error-banner";
import { RefreshingRegion } from "@/components/refreshing-region";
import { TitleLeaf } from "@/components/title-leaf";
import { useAuthStore } from "@/features/auth";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";

import type { StatisticsScopeState } from "../../model/statistics-scope-state";
import type { UseStatisticsParamsResult } from "../../model/use-statistics-params";

import { useReadingStatisticsOverview } from "../../api/use-reading-statistics-overview";
import { newAccountStart } from "../../model/statistics-account-history";
import { isLowerBoundComparison } from "../../model/statistics-dynamics";
import { toStatisticsScopeState } from "../../model/statistics-scope-state";
import { isComparedTab, STATISTICS_VIEW, toStatisticsTab } from "../../model/statistics-view";
import { useStatisticsParams } from "../../model/use-statistics-params";
import { useStatisticsView } from "../../model/use-statistics-view";
import { StatisticsPeriodControls } from "../controls/statistics-period-controls";
import {
  StatisticsError,
  StatisticsNote,
  StatisticsProgressSkeleton,
  StatisticsRefreshingNote,
  StatisticsSectionState,
  StatisticsSkeleton,
} from "../statistics-states";
import { StatisticsActivityTab } from "./statistics-activity-tab";
import { StatisticsOverviewTab } from "./statistics-overview-tab";
import { StatisticsProgressTab } from "./statistics-progress-tab";
import { StatisticsTastesTab } from "./statistics-tastes-tab";

export function StatisticsOverview() {
  const t = useTranslations("statistics");
  const params = useStatisticsParams();
  const query = useReadingStatisticsOverview(params.queryParams, {
    enabled: params.isRequestable,
  });
  const scope = toStatisticsScopeState(query);
  const currentOverview = scope.isPlaceholderData ? undefined : scope.data;
  const view = useStatisticsView(params.state);
  const periodTriggerRef = useRef<HTMLButtonElement>(null);
  const statisticsBodyRef = useRef<HTMLElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(statisticsBodyRef);

  const showAllTime = () => {
    periodTriggerRef.current?.focus();
    params.setPeriod("all_time");
  };

  return (
    <div className="flex flex-col gap-4">
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
        comparisonAvailability={isComparedTab(view.tab) ? "available" : "tab"}
        params={params}
        period={currentOverview?.period ?? null}
        periodTriggerRef={periodTriggerRef}
      />

      {scope.isPlaceholderData ? (
        <StatisticsRefreshingNote reason="periodChange" />
      ) : scope.isRefreshing ? (
        <StatisticsRefreshingNote />
      ) : null}
      <RefetchErrorBanner
        state={
          scope.isRefetchError ? { isRetrying: scope.isRefreshing, onRetry: scope.retry } : null
        }
      />

      <section
        aria-label={t("resultsLabel")}
        className={RETRY_FOCUS_RING.onTarget}
        ref={statisticsBodyRef}
        tabIndex={-1}
      >
        <StatisticsBody
          onRetry={withRetryFocus(scope.retry)}
          onShowAllTime={showAllTime}
          params={params}
          retryButtonRef={retryButtonRef}
          scope={scope}
        />
      </section>
    </div>
  );
}

function StatisticsBody({
  onRetry,
  onShowAllTime,
  params,
  retryButtonRef,
  scope,
}: {
  onRetry: () => void;
  onShowAllTime: () => void;
  params: UseStatisticsParamsResult;
  retryButtonRef: Ref<HTMLButtonElement>;
  scope: StatisticsScopeState<ReadingStatisticsOverview>;
}) {
  const t = useTranslations("statistics");
  const { tab } = useStatisticsView(params.state);
  const user = useAuthStore((state) => state.user);
  const overview = scope.data;

  if (scope.isInitialError) {
    return <StatisticsError onRetry={onRetry} retryButtonRef={retryButtonRef} />;
  }

  if (overview === undefined) {
    if (!params.isRequestable) {
      return (
        <StatisticsSectionState
          description={t("states.invalidRange.description")}
          kind="insufficient"
          title={t("states.invalidRange.title")}
        />
      );
    }

    return tab === "progress" ? <StatisticsProgressSkeleton /> : <StatisticsSkeleton />;
  }

  const isLowerBound =
    newAccountStart({ meta: overview.meta, user }) === null &&
    overview.meta.activityHistory.selectedPeriodQuality === "legacy_lower_bound";

  return (
    <RefreshingRegion
      aria-busy={scope.isRefreshing}
      className="flex flex-col gap-4"
      isRefreshing={scope.isPlaceholderData}
    >
      {isLowerBound ? <StatisticsNote>{t("states.lowerBound")}</StatisticsNote> : null}

      <StatisticsTabs
        isLowerBound={isLowerBound}
        onShowAllTime={onShowAllTime}
        overview={overview}
        params={params}
      />
    </RefreshingRegion>
  );
}

function StatisticsTabs({
  isLowerBound,
  onShowAllTime,
  overview,
  params,
}: {
  isLowerBound: boolean;
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
        <StatisticsActivityTab
          isComparisonLowerBound={isComparisonLowerBound}
          onShowAllTime={onShowAllTime}
          overview={overview}
          view={view}
        />
      </PageTabsPanel>

      <PageTabsPanel className="flex flex-col gap-4" value="tastes">
        <StatisticsTastesTab onShowAllTime={onShowAllTime} overview={overview} view={view} />
      </PageTabsPanel>

      <PageTabsPanel className="@container flex flex-col gap-4" value="progress">
        <StatisticsProgressTab isLowerBound={isLowerBound} overview={overview} />
      </PageTabsPanel>
    </PageTabs>
  );
}
