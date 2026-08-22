"use client";

import type { BookOrderStatisticsDaily } from "@app/shared";

import { parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

import type { CalendarCell, CalendarMetric } from "../../model/statistics-calendar";
import type { StatisticsDrilldownFilters } from "../../model/statistics-drilldown";

import { formatCurrencyTotals } from "../../model/money-format";
import { CALENDAR_METRICS, calendarGrid, calendarYears } from "../../model/statistics-calendar";
import { dayHref } from "../../model/statistics-drilldown";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics-section";

const CELL_PITCH_PX = 14;

const LEVEL_CLASS = [
  "bg-secondary",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
] as const;

export function StatisticsCalendar({
  daily,
  drilldown,
  today,
}: {
  daily: BookOrderStatisticsDaily;
  drilldown: StatisticsDrilldownFilters;
  today: string;
}) {
  const t = useTranslations("delivery.statistics.calendar");
  const locale = useLocale();
  const router = useRouter();
  const [metric, setMetric] = useState<CalendarMetric>("orders");

  const years = calendarYears(daily);
  const [year, setYear] = useState<null | number>(null);
  const activeYear = year !== null && years.includes(year) ? year : (years[0] ?? null);

  const grid =
    activeYear === null ? null : calendarGrid({ daily, metric, today, year: activeYear });

  return (
    <StatisticsSection
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatisticsMetricTabs
            label={t("metricLabel")}
            metrics={CALENDAR_METRICS}
            onChange={setMetric}
            optionLabel={(value) => t(`metrics.${value}`)}
            value={metric}
          />
          {years.length > 1 ? (
            <Select onValueChange={(value) => setYear(Number(value))} value={String(activeYear)}>
              <SelectTrigger aria-label={t("yearLabel")} className="w-24 data-[size=default]:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((entry) => (
                  <SelectItem key={entry} value={String(entry)}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      }
      className="h-full"
      description={t("subtitle")}
      title={t("title")}
    >
      {grid === null ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max flex-col gap-1">
              <div className="relative h-4">
                {grid.monthLabels.map((label) => (
                  <span
                    className="absolute top-0 text-[0.6875rem] text-muted-foreground"
                    key={label.monthStart}
                    style={{ left: `${label.weekIndex * CELL_PITCH_PX}px` }}
                  >
                    {monthShortLabel(label.monthStart, locale)}
                  </span>
                ))}
              </div>
              <div className="flex gap-[3px]">
                {grid.weeks.map((week, weekIndex) => (
                  <div className="flex flex-col gap-[3px]" key={weekIndex}>
                    {week.map((cell, dayIndex) =>
                      cell === null ? (
                        <span className="size-[11px] rounded-[3px]" key={dayIndex} />
                      ) : (
                        <CalendarDay
                          cell={cell}
                          key={cell.date}
                          onOpen={() => router.push(dayHref(cell.date, drilldown))}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t("less")}</span>
            {LEVEL_CLASS.map((className, level) => (
              <span className={`size-[11px] rounded-[3px] ${className}`} key={level} />
            ))}
            <span>{t("more")}</span>
          </div>
        </>
      )}
    </StatisticsSection>
  );
}

function CalendarDay({ cell, onOpen }: { cell: CalendarCell; onOpen: () => void }) {
  const t = useTranslations("delivery.statistics.calendar");
  const locale = useLocale();

  const summary =
    cell.value === 0
      ? t("dayEmpty", { date: formatDateLong(cell.date, locale) })
      : t("daySummary", {
          books: cell.booksCount,
          date: formatDateLong(cell.date, locale),
          orders: cell.ordersCount,
        });

  if (cell.value === 0) {
    return (
      <span
        aria-label={summary}
        className={`size-[11px] rounded-[3px] ${LEVEL_CLASS[0]}`}
        role="img"
        title={summary}
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={summary}
        className={`size-[11px] cursor-pointer rounded-[3px] transition-transform outline-none hover:scale-125 focus-visible:ring-[3px] focus-visible:ring-ring/50 ${LEVEL_CLASS[cell.level]}`}
        onClick={onOpen}
        type="button"
      />
      <TooltipContent>
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{formatDateLong(cell.date, locale)}</span>
          <span>{t("counts", { books: cell.booksCount, orders: cell.ordersCount })}</span>
          {cell.totalsByCurrency.length === 0 ? null : (
            <span className="tabular-nums">
              {formatCurrencyTotals(cell.totalsByCurrency, locale)}
            </span>
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function monthShortLabel(monthStart: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(parseISO(monthStart));
}
