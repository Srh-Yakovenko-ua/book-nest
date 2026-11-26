"use client";

import type {
  Nullable,
  ReadingStatisticsCalendarPage,
  ReadingStatisticsCalendarSection,
  WeekStartDay,
} from "@app/shared";
import type { ReactNode, Ref, RefObject } from "react";

import { useTranslations } from "next-intl";
import { useId, useRef } from "react";

import { RefetchErrorBanner } from "@/components/refetch-error-banner";
import { RefreshingRegion } from "@/components/refreshing-region";
import { TitleLeaf } from "@/components/title-leaf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { YearPicker } from "@/components/ui/year-picker";
import { useRetryFocus } from "@/hooks/use-retry-focus";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";

import type { StatisticsScopeState } from "../../model/statistics-scope-state";
import type { UseReadingCalendarParamsResult } from "../../model/use-reading-calendar-params";

import { useReadingCalendarPage } from "../../api/use-reading-calendar-page";
import { useBooksCalendarJump } from "../../hooks/use-books-calendar-jump";
import { useMobileViewport } from "../../hooks/use-mobile-viewport";
import { useReadingCalendarMonth } from "../../hooks/use-reading-calendar-month";
import { toStatisticsScopeState } from "../../model/statistics-scope-state";
import { useReadingCalendarParams } from "../../model/use-reading-calendar-params";
import { ReadingBooksCalendar } from "../reading/reading-books-calendar";
import { ReadingBooksDayPanel } from "../reading/reading-books-day-panel";
import { ReadingBooksMonthHeader } from "../reading/reading-books-month-header";
import { ReadingBooksMonthLegend } from "../reading/reading-books-month-legend";
import { ReadingQuarterActivityCard } from "../reading/reading-quarter-activity-card";
import { StatisticsSection } from "../statistics-section";
import {
  StatisticsError,
  StatisticsNote,
  StatisticsRefreshingNote,
  StatisticsSectionState,
} from "../statistics-states";

const CALENDAR_LAYOUT_CLASS = {
  books:
    "scroll-mt-[calc(var(--shell-header-height)+1rem)] rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring data-jump-highlight:ring-2 data-jump-highlight:ring-primary",
  column: "flex min-w-0 flex-col gap-4",
  columns:
    "grid items-start gap-4 lg:@4xl/reading-calendar:grid-cols-[minmax(0,1.85fr)_minmax(17.5rem,1fr)]",
  root: "@container/reading-calendar",
} as const;

export function ReadingCalendarPage() {
  const t = useTranslations("readingCalendar");
  const params = useReadingCalendarParams();
  const scope = toStatisticsScopeState(useReadingCalendarPage({ year: params.year }));
  const booksSectionRef = useRef<HTMLDivElement>(null);
  const calendarBodyRef = useRef<HTMLElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(calendarBodyRef);
  const jump = useBooksCalendarJump({
    isCalendarCurrent: scope.data?.year === params.year && !scope.isPlaceholderData,
    month: params.month,
    sectionRef: booksSectionRef,
    selectDay: params.selectDay,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ReadingCalendarYearPicker
          availableYears={scope.data?.availableYears ?? []}
          params={params}
        />
      </header>

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
        ref={calendarBodyRef}
        tabIndex={-1}
      >
        <ReadingCalendarBody
          booksSectionRef={booksSectionRef}
          jump={jump}
          onRetry={withRetryFocus(scope.retry)}
          params={params}
          retryButtonRef={retryButtonRef}
          scope={scope}
        />
      </section>
    </div>
  );
}

function ReadingBooksSection({
  children,
  legend,
  sectionRef,
}: {
  children: ReactNode;
  legend?: ReactNode;
  sectionRef: RefObject<Nullable<HTMLDivElement>>;
}) {
  const t = useTranslations("readingCalendar.books");

  return (
    <div
      aria-label={t("title")}
      className={CALENDAR_LAYOUT_CLASS.books}
      ref={sectionRef}
      role="region"
      tabIndex={-1}
    >
      <Card className="gap-2 py-3">
        <CardHeader className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <CardTitle asChild>
            <h2 className="text-lg leading-6 font-semibold text-ink">{t("title")}</h2>
          </CardTitle>
          <CardDescription className="text-xs">{t("description")}</CardDescription>
          {legend === undefined ? null : <div className="ml-auto">{legend}</div>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function ReadingCalendarBody({
  booksSectionRef,
  jump,
  onRetry,
  params,
  retryButtonRef,
  scope,
}: {
  booksSectionRef: RefObject<Nullable<HTMLDivElement>>;
  jump: ReturnType<typeof useBooksCalendarJump>;
  onRetry: () => void;
  params: UseReadingCalendarParamsResult;
  retryButtonRef: Ref<HTMLButtonElement>;
  scope: StatisticsScopeState<ReadingStatisticsCalendarPage>;
}) {
  const t = useTranslations("readingCalendar");
  const tStates = useTranslations("statistics.states");
  const page = scope.data;

  if (scope.isInitialError) {
    return <StatisticsError onRetry={onRetry} retryButtonRef={retryButtonRef} />;
  }

  if (page === undefined) {
    return <ReadingCalendarSkeleton />;
  }

  const { calendar, meta } = page;
  const isCalendarShown = calendar.availability !== "unavailable" && calendar.days.length > 0;

  return (
    <RefreshingRegion
      aria-busy={scope.isRefreshing}
      className="flex flex-col gap-4"
      isRefreshing={scope.isPlaceholderData}
    >
      {meta.activityHistory.selectedPeriodQuality === "legacy_lower_bound" ? (
        <StatisticsNote>{tStates("lowerBound")}</StatisticsNote>
      ) : null}

      {isCalendarShown ? (
        <ReadingCalendarMonthLayout
          booksSectionRef={booksSectionRef}
          calendar={calendar}
          jump={jump}
          params={params}
          weekStartDay={meta.weekStartDay}
        />
      ) : (
        <ReadingCalendarColumns
          primary={
            <ReadingBooksSection sectionRef={booksSectionRef}>
              <ReadingCalendarState calendar={calendar} />
            </ReadingBooksSection>
          }
          secondary={
            <StatisticsSection title={t("activity.title")}>
              <ReadingCalendarState calendar={calendar} />
            </StatisticsSection>
          }
        />
      )}
    </RefreshingRegion>
  );
}

function ReadingCalendarColumns({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary: ReactNode;
}) {
  return (
    <div className={CALENDAR_LAYOUT_CLASS.root}>
      <div className={CALENDAR_LAYOUT_CLASS.columns}>
        <div className={CALENDAR_LAYOUT_CLASS.column}>{primary}</div>
        <div className={CALENDAR_LAYOUT_CLASS.column}>{secondary}</div>
      </div>
    </div>
  );
}

function ReadingCalendarMonthLayout({
  booksSectionRef,
  calendar,
  jump,
  params,
  weekStartDay,
}: {
  booksSectionRef: RefObject<Nullable<HTMLDivElement>>;
  calendar: ReadingStatisticsCalendarSection;
  jump: ReturnType<typeof useBooksCalendarJump>;
  params: UseReadingCalendarParamsResult;
  weekStartDay: WeekStartDay;
}) {
  const isMobile = useMobileViewport();
  const panelId = useId();
  const monthLabelRef = useRef<HTMLSpanElement>(null);
  const month = useReadingCalendarMonth({
    calendar,
    month: params.month,
    selectedDay: params.day,
  });

  return (
    <ReadingCalendarColumns
      primary={
        <>
          {month.monthKey === null ? null : (
            <ReadingBooksMonthHeader
              displayRange={calendar.displayRange}
              month={month}
              monthLabelRef={monthLabelRef}
              onMonthChange={params.setMonth}
            />
          )}
          <ReadingBooksSection
            legend={
              isMobile === false ? <ReadingBooksMonthLegend summary={month.summary} /> : undefined
            }
            sectionRef={booksSectionRef}
          >
            <ReadingBooksCalendar
              isMobile={isMobile}
              jumpTarget={jump.dayTarget}
              month={month}
              onSelectDay={params.selectDay}
              panelId={panelId}
              today={params.today}
              weekStartDay={weekStartDay}
            />
          </ReadingBooksSection>
        </>
      }
      secondary={
        <>
          <ReadingQuarterActivityCard
            days={calendar.days}
            displayRange={calendar.displayRange}
            month={month.monthKey ?? params.month}
            onShowInBooksCalendar={jump.showInBooksCalendar}
            today={params.today}
            weekStartDay={weekStartDay}
          />
          {isMobile === false && month.monthKey !== null ? (
            <ReadingBooksDayPanel
              id={panelId}
              isHistoryUncertain={month.isHistoryUncertain}
              onSelectDay={params.selectDay}
              selectableDays={month.selectableDays}
              selected={month.selected}
            />
          ) : null}
        </>
      }
    />
  );
}

function ReadingCalendarSkeleton() {
  const t = useTranslations("statistics.states");

  return (
    <div aria-busy aria-label={t("loading")} className={CALENDAR_LAYOUT_CLASS.root} role="status">
      <div className={CALENDAR_LAYOUT_CLASS.columns}>
        <div className={CALENDAR_LAYOUT_CLASS.column}>
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <div className={CALENDAR_LAYOUT_CLASS.column}>
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ReadingCalendarState({ calendar }: { calendar: ReadingStatisticsCalendarSection }) {
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

  return <StatisticsSectionState kind="empty" title={t("empty")} />;
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
    <div className="w-32 shrink-0">
      <YearPicker
        ariaLabel={t("yearLabel")}
        clearable={false}
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
