"use client";

import type { ReadingStatisticsCalendarPage, ReadingStatisticsCalendarSection } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { TitleLeaf } from "@/components/title-leaf";
import { Skeleton } from "@/components/ui/skeleton";
import { YearPicker } from "@/components/ui/year-picker";
import { cn } from "@/lib/utils";

import type { StatisticsScopeState } from "../../model/statistics-scope-state";
import type { UseReadingCalendarParamsResult } from "../../model/use-reading-calendar-params";

import { useReadingCalendarPage } from "../../api/use-reading-calendar-page";
import { toStatisticsScopeState } from "../../model/statistics-scope-state";
import { useReadingCalendarParams } from "../../model/use-reading-calendar-params";
import { ReadingBooksCalendar } from "../reading/reading-books-calendar";
import { ReadingHeatmap } from "../reading/reading-heatmap";
import { StatisticsSection } from "../statistics-section";
import {
  StatisticsError,
  StatisticsNote,
  StatisticsRefetchError,
  StatisticsRefreshingNote,
  StatisticsSectionState,
} from "../statistics-states";

export function ReadingCalendarPage() {
  const t = useTranslations("readingCalendar");
  const params = useReadingCalendarParams();
  const scope = toStatisticsScopeState(useReadingCalendarPage({ year: params.year }));

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

      <ReadingCalendarYearPicker
        availableYears={scope.data?.availableYears ?? []}
        params={params}
      />

      {scope.isPlaceholderData ? (
        <StatisticsRefreshingNote reason="periodChange" />
      ) : scope.isRefreshing ? (
        <StatisticsRefreshingNote />
      ) : null}
      {scope.isRefetchError ? <StatisticsRefetchError onRetry={scope.retry} /> : null}

      <ReadingCalendarBody params={params} scope={scope} />
    </div>
  );
}

function ReadingCalendarBody({
  params,
  scope,
}: {
  params: UseReadingCalendarParamsResult;
  scope: StatisticsScopeState<ReadingStatisticsCalendarPage>;
}) {
  const t = useTranslations("readingCalendar");
  const tStates = useTranslations("statistics.states");
  const page = scope.data;

  if (scope.isInitialError) {
    return <StatisticsError onRetry={scope.retry} />;
  }

  if (page === undefined) {
    return <ReadingCalendarSkeleton />;
  }

  const { calendar, meta } = page;

  return (
    <div
      aria-busy={scope.isRefreshing}
      className={cn(
        "flex flex-col gap-6 motion-safe:transition-opacity",
        scope.isPlaceholderData && "opacity-60",
      )}
      inert={scope.isPlaceholderData}
    >
      {meta.activityHistory.selectedPeriodQuality === "legacy_lower_bound" ? (
        <StatisticsNote>{tStates("lowerBound")}</StatisticsNote>
      ) : null}

      <StatisticsSection description={t("activity.description")} title={t("activity.title")}>
        <ReadingCalendarContent calendar={calendar}>
          <ReadingHeatmap days={calendar.days} weekStartDay={meta.weekStartDay} />
        </ReadingCalendarContent>
      </StatisticsSection>

      <StatisticsSection description={t("books.description")} title={t("books.title")}>
        <ReadingCalendarContent calendar={calendar}>
          <ReadingBooksCalendar
            calendar={calendar}
            month={params.month}
            onMonthChange={params.setMonth}
            weekStartDay={meta.weekStartDay}
          />
        </ReadingCalendarContent>
      </StatisticsSection>
    </div>
  );
}

function ReadingCalendarContent({
  calendar,
  children,
}: {
  calendar: ReadingStatisticsCalendarSection;
  children: ReactNode;
}) {
  const t = useTranslations("statistics.calendar");

  if (calendar.availability === "unavailable") {
    return (
      <StatisticsSectionState
        description={t(`reason.${calendar.reason ?? "NO_ACTIVITY_HISTORY"}`)}
        kind="unavailable"
        title={t("unavailable")}
      />
    );
  }

  if (calendar.days.length === 0) {
    return <StatisticsSectionState kind="empty" title={t("empty")} />;
  }

  return children;
}

function ReadingCalendarSkeleton() {
  const t = useTranslations("statistics.states");

  return (
    <div aria-busy aria-label={t("loading")} className="flex flex-col gap-6" role="status">
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

function ReadingCalendarYearPicker({
  availableYears,
  params,
}: {
  availableYears: readonly number[];
  params: UseReadingCalendarParamsResult;
}) {
  const t = useTranslations("statistics.period");
  const id = useId();

  return (
    <div className="w-32">
      <YearPicker
        ariaLabel={t("yearLabel")}
        clearLabel={t("yearClear")}
        id={id}
        max={params.currentYear}
        min={Math.min(availableYears[0] ?? params.currentYear, params.year)}
        nextLabel={t("yearNext")}
        onChange={(year) => params.setYear(year ?? params.currentYear)}
        prevLabel={t("yearPrev")}
        value={params.year}
      />
    </div>
  );
}
