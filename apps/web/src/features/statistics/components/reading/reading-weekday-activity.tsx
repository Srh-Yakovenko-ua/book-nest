"use client";

import type {
  Nullable,
  ReadingStatisticsCalendarSection,
  StatisticsWeekdayActivityItem,
  WeekStartDay,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { weekdayOrder } from "../../model/statistics-calendar";
import { weekdayLabel } from "../../model/statistics-format";
import { StatisticsSection } from "../statistics-section";
import { ReadingWeekdayDetails } from "./reading-weekday-details";

const WEEKDAY_LIST = {
  barFill: "h-full rounded-full bg-primary/70",
  barTrack: "h-1.5 w-full overflow-hidden rounded-full bg-secondary",
  dayBadge:
    "grid size-8 place-items-center rounded-full bg-secondary text-xs font-medium text-ink transition-colors group-hover:bg-accent",
  header:
    "col-span-4 grid grid-cols-subgrid px-2 pb-1 text-xs font-medium whitespace-nowrap text-muted-foreground",
  list: "col-span-4 grid grid-cols-subgrid gap-y-0.5",
  number: "text-end text-sm whitespace-nowrap text-foreground tabular-nums",
  row: "group relative col-span-4 grid grid-cols-subgrid items-center rounded-md px-2 py-1 transition-colors hover:bg-accent/60 has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-ring/50",
  rowButton: "absolute inset-0 cursor-pointer rounded-md outline-none",
  selected: "font-semibold text-ink",
  selectedDayBadge: "bg-primary font-semibold text-primary-foreground group-hover:bg-primary",
  selectedRow: "bg-accent/20",
} as const;

export function ReadingWeekdayActivity({
  calendar,
  weekStartDay,
}: {
  calendar: ReadingStatisticsCalendarSection;
  weekStartDay: WeekStartDay;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.habits.weekdays");
  const tSummary = useTranslations("statistics.calendar.summary");
  const [selectedWeekday, setSelectedWeekday] = useState<Nullable<number>>(null);
  const { weekdayActivity } = calendar;

  if (weekdayActivity.availability === "unavailable") return null;

  const isLowerBound = weekdayActivity.availability === "partial";
  const lowerBound = (value: string) =>
    isLowerBound ? tSummary("lowerBoundValue", { value }) : value;

  const rows = weekdayOrder(weekStartDay).flatMap((weekday) =>
    weekdayActivity.items.filter((item) => item.weekday === weekday),
  );
  const peakActiveDays = rows.reduce((peak, row) => Math.max(peak, row.activeDays), 0);
  const defaultRow = rows.reduce<Nullable<StatisticsWeekdayActivityItem>>(
    (best, row) => (best === null || isBusierWeekday(row, best) ? row : best),
    null,
  );
  const selectedRow = rows.find((row) => row.weekday === selectedWeekday) ?? defaultRow;

  return (
    <StatisticsSection description={t("description")} title={t("title")}>
      {peakActiveDays === 0 || selectedRow === null ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-20 xl:items-start xl:gap-6">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 xl:col-span-13">
            <div aria-hidden className={WEEKDAY_LIST.header}>
              <span className="text-center">{t("columns.day")}</span>
              <span>{t("columns.bar")}</span>
              <span className="text-end">{t("columns.days")}</span>
              <span className="text-end">{t("columns.pages")}</span>
            </div>
            <ul aria-label={t("title")} className={WEEKDAY_LIST.list}>
              {rows.map((row) => {
                const isSelected = row.weekday === selectedRow.weekday;
                const emphasis = isSelected ? WEEKDAY_LIST.selected : undefined;

                return (
                  <li
                    className={cn(WEEKDAY_LIST.row, isSelected && WEEKDAY_LIST.selectedRow)}
                    key={row.weekday}
                  >
                    <button
                      aria-pressed={isSelected}
                      className={WEEKDAY_LIST.rowButton}
                      onClick={() => setSelectedWeekday(row.weekday)}
                      type="button"
                    >
                      <span className="sr-only">
                        {weekdayLabel({ locale, weekday: row.weekday })}
                      </span>
                    </button>
                    <span
                      aria-hidden
                      className={cn(
                        WEEKDAY_LIST.dayBadge,
                        isSelected && WEEKDAY_LIST.selectedDayBadge,
                      )}
                    >
                      {weekdayLabel({ locale, weekday: row.weekday, width: "short" })}
                    </span>
                    <div aria-hidden className={WEEKDAY_LIST.barTrack}>
                      <div
                        className={WEEKDAY_LIST.barFill}
                        style={{ width: `${(row.activeDays / peakActiveDays) * 100}%` }}
                      />
                    </div>
                    <span className={cn(WEEKDAY_LIST.number, emphasis)}>
                      <span className="sr-only">{t("columns.days")} </span>
                      {lowerBound(String(row.activeDays))}
                    </span>
                    <span className={cn(WEEKDAY_LIST.number, emphasis)}>
                      <span className="sr-only">{t("columns.pages")} </span>
                      {lowerBound(formatNumber(row.pagesRead, locale))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="xl:col-span-7 xl:border-l xl:border-border xl:pl-5">
            <ReadingWeekdayDetails isLowerBound={isLowerBound} row={selectedRow} />
          </div>
        </div>
      )}
    </StatisticsSection>
  );
}

function isBusierWeekday(
  candidate: StatisticsWeekdayActivityItem,
  current: StatisticsWeekdayActivityItem,
): boolean {
  if (candidate.activeDays !== current.activeDays) return candidate.activeDays > current.activeDays;
  return candidate.pagesRead > current.pagesRead;
}
