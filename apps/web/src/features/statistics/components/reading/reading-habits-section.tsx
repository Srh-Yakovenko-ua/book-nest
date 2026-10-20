"use client";

import type { ReadingStatisticsCalendarSection, ReadingStatisticsMeta } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatDayRange } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";
import { ReadingCalendarSummary } from "./reading-calendar-summary";
import { ReadingWeekdayActivity } from "./reading-weekday-activity";

export function ReadingHabitsSection({
  calendar,
  meta,
}: {
  calendar: ReadingStatisticsCalendarSection;
  meta: ReadingStatisticsMeta;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics");

  const isLowerBound = meta.activityHistory.selectedPeriodQuality === "legacy_lower_bound";
  const metricLabel = formatDayRange({
    from: calendar.metricRange.from,
    locale,
    to: calendar.metricRange.to,
  });

  if (calendar.availability === "unavailable") {
    return (
      <StatisticsSection description={t("habits.description")} title={t("habits.title")}>
        <StatisticsSectionState
          description={t(`calendar.reason.${calendar.reason ?? "NO_ACTIVITY_HISTORY"}`)}
          kind="unavailable"
          title={t("habits.unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      description={
        metricLabel === null
          ? t("habits.description")
          : t("habits.metricRange", { range: metricLabel })
      }
      title={t("habits.title")}
    >
      <ReadingCalendarSummary calendar={calendar} isLowerBound={isLowerBound} />
      <ReadingWeekdayActivity calendar={calendar} weekStartDay={meta.weekStartDay} />
    </StatisticsSection>
  );
}
