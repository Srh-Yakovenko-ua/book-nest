"use client";

import type {
  Nullable,
  ReadingStatisticsCalendarPage,
  ReadingStatisticsCalendarSection,
} from "@app/shared";
import type { ReactNode, RefObject } from "react";

import { useTranslations } from "next-intl";
import { useId, useRef } from "react";

import { TitleLeaf } from "@/components/title-leaf";
import { Skeleton } from "@/components/ui/skeleton";
import { YearPicker } from "@/components/ui/year-picker";
import { cn } from "@/lib/utils";

import type { StatisticsScopeState } from "../../model/statistics-scope-state";
import type { UseReadingCalendarParamsResult } from "../../model/use-reading-calendar-params";

import { useReadingCalendarPage } from "../../api/use-reading-calendar-page";
import { useBooksCalendarJump } from "../../hooks/use-books-calendar-jump";
import { toStatisticsScopeState } from "../../model/statistics-scope-state";
import { useReadingCalendarParams } from "../../model/use-reading-calendar-params";
import { ReadingBooksCalendar } from "../reading/reading-books-calendar";
import { ReadingBooksMonthNav } from "../reading/reading-books-month-nav";
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
  const booksSectionRef = useRef<HTMLDivElement>(null);
  const jump = useBooksCalendarJump({
    isCalendarCurrent: scope.data?.year === params.year && !scope.isPlaceholderData,
    month: params.month,
    sectionRef: booksSectionRef,
    setMonth: params.setMonth,
  });

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

      <ReadingCalendarBody
        booksSectionRef={booksSectionRef}
        jump={jump}
        params={params}
        scope={scope}
      />
    </div>
  );
}

function ReadingCalendarBody({
  booksSectionRef,
  jump,
  params,
  scope,
}: {
  booksSectionRef: RefObject<Nullable<HTMLDivElement>>;
  jump: ReturnType<typeof useBooksCalendarJump>;
  params: UseReadingCalendarParamsResult;
  scope: StatisticsScopeState<ReadingStatisticsCalendarPage>;
}) {
  const t = useTranslations("readingCalendar");
  const tStates = useTranslations("statistics.states");
  const monthLabelRef = useRef<HTMLSpanElement>(null);
  const page = scope.data;

  if (scope.isInitialError) {
    return <StatisticsError onRetry={scope.retry} />;
  }

  if (page === undefined) {
    return <ReadingCalendarSkeleton />;
  }

  const { calendar, meta } = page;
  const isCalendarShown = calendar.availability !== "unavailable" && calendar.days.length > 0;

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
          <ReadingHeatmap
            days={calendar.days}
            onShowInBooksCalendar={jump.showInBooksCalendar}
            weekStartDay={meta.weekStartDay}
          />
        </ReadingCalendarContent>
      </StatisticsSection>

      <div
        aria-label={t("books.title")}
        className="scroll-mt-4 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring data-jump-highlight:ring-2 data-jump-highlight:ring-primary"
        ref={booksSectionRef}
        role="region"
        tabIndex={-1}
      >
        <StatisticsSection
          action={
            isCalendarShown ? (
              <ReadingBooksMonthNav
                displayRange={calendar.displayRange}
                month={params.month}
                monthLabelRef={monthLabelRef}
                onMonthChange={params.setMonth}
              />
            ) : undefined
          }
          description={t("books.description")}
          title={t("books.title")}
        >
          <ReadingCalendarContent calendar={calendar}>
            <ReadingBooksCalendar
              calendar={calendar}
              jumpTarget={jump.dayTarget}
              month={params.month}
              monthLabelRef={monthLabelRef}
              today={params.today}
              weekStartDay={meta.weekStartDay}
            />
          </ReadingCalendarContent>
        </StatisticsSection>
      </div>
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
