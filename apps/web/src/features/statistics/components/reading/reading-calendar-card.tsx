"use client";

import type {
  Nullable,
  ReadingStatisticsCalendarSection,
  ReadingStatisticsMeta,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent } from "react";

import type { CalendarMode } from "../../model/statistics-view";

import { listCalendarMonths } from "../../model/statistics-calendar";
import { formatDayRange } from "../../model/statistics-format";
import { STATISTICS_VIEW } from "../../model/statistics-view";
import { StatisticsMetricTabs, StatisticsSection } from "../statistics-section";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { ReadingBooksCalendar } from "./reading-books-calendar";
import { ReadingHeatmap } from "./reading-heatmap";

export function ReadingCalendarCard({
  calendar,
  meta,
  mode,
  month,
  onModeChange,
  onMonthChange,
}: {
  calendar: ReadingStatisticsCalendarSection;
  meta: ReadingStatisticsMeta;
  mode: CalendarMode;
  month: Nullable<string>;
  onModeChange: (mode: CalendarMode) => void;
  onMonthChange: (month: Nullable<string>) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar");

  const isMonthStale =
    calendar.availability === "available" &&
    month !== null &&
    !listCalendarMonths(calendar.displayRange).includes(month);
  const discardStaleMonth = useEffectEvent(() => onMonthChange(null));

  useEffect(() => {
    if (isMonthStale) discardStaleMonth();
  }, [isMonthStale, month]);

  const isLowerBound = meta.activityHistory.selectedPeriodQuality === "legacy_lower_bound";
  const metricLabel = formatDayRange({
    from: calendar.metricRange.from,
    locale,
    to: calendar.metricRange.to,
  });
  const displayLabel = formatDayRange({
    from: calendar.displayRange.from,
    locale,
    to: calendar.displayRange.to,
  });
  const isDisplayNarrower =
    calendar.displayRange.from !== calendar.metricRange.from ||
    calendar.displayRange.to !== calendar.metricRange.to;

  if (calendar.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          description={t(`reason.${calendar.reason ?? "NO_ACTIVITY_HISTORY"}`)}
          kind="unavailable"
          title={t("unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("modeLabel")}
          metrics={STATISTICS_VIEW.calendarModes}
          onChange={onModeChange}
          optionLabel={(value) => t(`modes.${value}`)}
          value={mode}
        />
      }
      description={
        metricLabel === null ? t("description") : t("metricRange", { range: metricLabel })
      }
      note={
        <>
          {isDisplayNarrower && displayLabel !== null ? (
            <StatisticsNote>{t("displayRange", { range: displayLabel })}</StatisticsNote>
          ) : null}
          {isLowerBound ? <StatisticsNote>{t("legacyNote")}</StatisticsNote> : null}
        </>
      }
      title={t("title")}
    >
      {calendar.days.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : mode === "activity" ? (
        <ReadingHeatmap days={calendar.days} weekStartDay={meta.weekStartDay} />
      ) : (
        <ReadingBooksCalendar
          calendar={calendar}
          month={month}
          onMonthChange={onMonthChange}
          weekStartDay={meta.weekStartDay}
        />
      )}
    </StatisticsSection>
  );
}
