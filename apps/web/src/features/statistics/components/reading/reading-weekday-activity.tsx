"use client";

import type { ReadingStatisticsCalendarSection, WeekStartDay } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { formatNumber } from "@/lib/format";

import { weekdayOrder } from "../../model/statistics-calendar";
import { weekdayLabel } from "../../model/statistics-format";
import { StatisticsNote } from "../statistics-states";

export function ReadingWeekdayActivity({
  calendar,
  weekStartDay,
}: {
  calendar: ReadingStatisticsCalendarSection;
  weekStartDay: WeekStartDay;
}) {
  const headingId = useId();
  const locale = useLocale();
  const t = useTranslations("statistics");
  const { mostActiveWeekday, weekdayActivity } = calendar;

  if (weekdayActivity.availability === "unavailable") return null;

  const isPartial = weekdayActivity.availability === "partial";
  const atLeast = (value: string) =>
    isPartial ? t("calendar.summary.lowerBoundValue", { value }) : value;
  const rows = weekdayOrder(weekStartDay).flatMap((weekday) =>
    weekdayActivity.items.filter((item) => item.weekday === weekday),
  );
  const peakActiveDays = rows.reduce((peak, row) => Math.max(peak, row.activeDays), 0);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-ink" id={headingId}>
          {t("habits.weekdays.title")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("habits.weekdays.caption")}</p>
      </div>

      {peakActiveDays === 0 ? (
        <p className="text-sm text-muted-foreground">{t("habits.weekdays.empty")}</p>
      ) : (
        <>
          <ul aria-labelledby={headingId} className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <li className="flex flex-col gap-1.5" key={row.weekday}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    <span aria-hidden>
                      {weekdayLabel({ locale, weekday: row.weekday, width: "short" })}
                    </span>
                    <span className="sr-only">
                      {weekdayLabel({ locale, weekday: row.weekday })}
                    </span>
                  </span>
                  <span className="min-w-0 text-right text-xs text-muted-foreground tabular-nums">
                    {t("habits.weekdays.value", {
                      days: atLeast(t("calendar.summary.days", { count: row.activeDays })),
                      pages: atLeast(
                        t("habits.weekdays.pages", {
                          pages: formatNumber(row.pagesRead, locale),
                          pagesCount: row.pagesRead,
                        }),
                      ),
                    })}
                  </span>
                </div>
                <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${(row.activeDays / peakActiveDays) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {mostActiveWeekday.data === null ? null : (
            <p className="text-xs text-muted-foreground">{t("habits.weekdays.criterion")}</p>
          )}
        </>
      )}

      {isPartial ? <StatisticsNote>{t("habits.weekdays.partialNote")}</StatisticsNote> : null}
    </div>
  );
}
