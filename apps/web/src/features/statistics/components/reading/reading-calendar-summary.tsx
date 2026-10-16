"use client";

import type { ReadingStatisticsCalendarSection } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatNumber } from "@/lib/format";

import { formatShare, weekdayLabel } from "../../model/statistics-format";
import { StatisticsStat } from "../statistics-stat";

export function ReadingCalendarSummary({
  calendar,
  isLowerBound,
}: {
  calendar: ReadingStatisticsCalendarSection;
  isLowerBound: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.summary");

  const lowerBound = (value: string) => (isLowerBound ? t("lowerBoundValue", { value }) : value);
  const { activeDaysPercentage, currentStreak, mostActiveWeekday } = calendar;

  const currentStreakData =
    currentStreak.availability === "unavailable" ? null : currentStreak.data;

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatisticsStat
          label={t("activeDays")}
          value={lowerBound(t("days", { count: calendar.activeDays }))}
        />

        <StatisticsStat
          hint={
            activeDaysPercentage.availability === "unavailable"
              ? t(`reason.${activeDaysPercentage.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)
              : undefined
          }
          label={t("activeDaysRate")}
          value={
            activeDaysPercentage.availability === "unavailable" ||
            activeDaysPercentage.value === null
              ? t("unavailable")
              : lowerBound(`${formatShare(activeDaysPercentage.value, locale)}%`)
          }
        />

        <StatisticsStat
          label={t("longestStreak")}
          value={lowerBound(t("days", { count: calendar.longestStreak.days }))}
        />

        {mostActiveWeekday.availability === "unavailable" || mostActiveWeekday.data === null ? (
          <StatisticsStat
            hint={
              mostActiveWeekday.availability === "unavailable"
                ? t(`reason.${mostActiveWeekday.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)
                : undefined
            }
            label={t("mostActiveWeekday")}
            value={t("unavailable")}
          />
        ) : (
          <StatisticsStat
            hint={t("weekdayHint", {
              days: mostActiveWeekday.data.activeDays,
              pages: formatNumber(mostActiveWeekday.data.pagesRead, locale),
            })}
            label={t("mostActiveWeekday")}
            value={weekdayLabel({ locale, weekday: mostActiveWeekday.data.weekday })}
          />
        )}
      </dl>

      {currentStreakData === null ? null : (
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
          <span>
            {t.rich("currentStreakLine", {
              days: currentStreakData.continuesBeforeRange
                ? t("daysAtLeast", { count: currentStreakData.days })
                : t("days", { count: currentStreakData.days }),
              value: (chunks) => (
                <span className="font-semibold text-ink tabular-nums">{chunks}</span>
              ),
            })}
          </span>
          {currentStreakData.continuesBeforeRange ? (
            <>
              <span aria-hidden>·</span>
              <span>{t("continuesBeforeRange")}</span>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
