"use client";

import type {
  BookOrderStatisticsDaily,
  Nullable,
  StatisticsCalendarCoverage,
  StatisticsPeriod,
} from "@app/shared";
import type { ReactNode } from "react";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { addDays, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

import type {
  CalendarCell,
  CalendarGrid,
  CalendarMetric,
  CalendarMonthLabel,
  CalendarScope,
} from "../../model/statistics-calendar";
import type {
  StatisticsDrilldownContext,
  StatisticsDrilldownLink,
} from "../../model/statistics-drilldown";

import { formatCurrencyTotals } from "../../model/money-format";
import {
  CALENDAR,
  CALENDAR_METRICS,
  calendarGrid,
  calendarHasDatedPurchases,
  calendarScope,
  resolveCalendarYear,
} from "../../model/statistics-calendar";
import { statisticsDrilldownLinks } from "../../model/statistics-drilldown";
import { StatisticsDrilldownMenuContent } from "./statistics-drilldown-action";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics-section";
import { StatisticsDataQualityNote, StatisticsSectionState } from "./statistics-states";

const CALENDAR_UI = {
  activeClass: "ring-2 brightness-90",
  cellSizePx: 14,
  disabledClass: "cursor-not-allowed",
  gapPx: 3,
  interactiveClass:
    "outline-none ring-ring ring-offset-1 ring-offset-card transition-[box-shadow,filter] hover:ring-2 hover:brightness-90 focus-visible:ring-2 focus-visible:brightness-90",
  minMonthLabelPx: 34,
  monthLabelGapPx: 4,
  monthLabelRowPx: 16,
  radiusClass: "rounded-[3px]",
  scrollerClass:
    "overflow-x-auto rounded-md px-1 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
  weekdayAnchorDate: "2026-01-05",
  weekdayLabelRows: [0, 2, 4, 6],
} as const;

const CALENDAR_LAYOUT = {
  cellBox: { height: `${CALENDAR_UI.cellSizePx}px`, width: `${CALENDAR_UI.cellSizePx}px` },
  gridGap: { gap: `${CALENDAR_UI.gapPx}px` },
  labelGap: { gap: `${CALENDAR_UI.monthLabelGapPx}px` },
  labelRow: { height: `${CALENDAR_UI.monthLabelRowPx}px` },
  pitchPx: CALENDAR_UI.cellSizePx + CALENDAR_UI.gapPx,
  weekdayOffset: {
    paddingTop: `${CALENDAR_UI.monthLabelRowPx + CALENDAR_UI.monthLabelGapPx}px`,
  },
} as const;

type CalendarMonthLabelBox = {
  leftPx: number;
  monthStart: string;
  widthPx: number;
};

export function StatisticsCalendar({
  coverage,
  daily,
  drilldown,
  isTruncated,
  period,
  today,
}: {
  coverage: StatisticsCalendarCoverage;
  daily: BookOrderStatisticsDaily;
  drilldown: StatisticsDrilldownContext;
  isTruncated: boolean;
  period: StatisticsPeriod;
  today: string;
}) {
  const t = useTranslations("delivery.statistics.calendar");
  const truncatedNoticeId = useId();
  const [metric, setMetric] = useState<CalendarMetric>("orders");
  const [requestedYear, setRequestedYear] = useState<Nullable<number>>(null);

  const scope = calendarScope({ daily, period, today });
  const year = scope === null ? null : resolveCalendarYear({ requested: requestedYear, scope });
  const grid =
    scope === null || year === null ? null : calendarGrid({ daily, metric, scope, year });

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("metricLabel")}
          metrics={CALENDAR_METRICS}
          onChange={setMetric}
          optionLabel={(value) => t(`metrics.${value}`)}
          value={metric}
        />
      }
      description={t(`subtitle.${metric}`)}
      title={t("title")}
    >
      {isTruncated ? (
        <div id={truncatedNoticeId}>
          <StatisticsSectionState
            description={t("truncated.description")}
            kind="insufficient"
            title={t("truncated.title")}
          />
        </div>
      ) : null}

      <CalendarContent
        coverage={coverage}
        drilldown={drilldown}
        grid={grid}
        hasDatedPurchases={scope !== null && calendarHasDatedPurchases({ daily, metric, scope })}
        isTruncated={isTruncated}
        metric={metric}
        onYearChange={setRequestedYear}
        scope={scope}
        truncatedNoticeId={truncatedNoticeId}
        year={year}
      />
    </StatisticsSection>
  );
}

function CalendarContent({
  coverage,
  drilldown,
  grid,
  hasDatedPurchases,
  isTruncated,
  metric,
  onYearChange,
  scope,
  truncatedNoticeId,
  year,
}: {
  coverage: StatisticsCalendarCoverage;
  drilldown: StatisticsDrilldownContext;
  grid: Nullable<CalendarGrid>;
  hasDatedPurchases: boolean;
  isTruncated: boolean;
  metric: CalendarMetric;
  onYearChange: (year: number) => void;
  scope: Nullable<CalendarScope>;
  truncatedNoticeId: string;
  year: Nullable<number>;
}) {
  const t = useTranslations("delivery.statistics.calendar");
  const locale = useLocale();
  const coverageNote = <CalendarCoverageNote count={coverage.ordersWithoutOrderDate} />;

  if (coverage.ordersInScope > 0 && coverage.ordersWithOrderDate === 0) {
    return (
      <>
        <StatisticsSectionState kind="empty" title={t("empty.noDates")} />
        {coverageNote}
      </>
    );
  }

  if (scope === null || grid === null || year === null || !hasDatedPurchases) {
    return (
      <>
        <StatisticsSectionState
          description={t("empty.period.description")}
          kind="empty"
          title={t("empty.period.title")}
        />
        {coverageNote}
      </>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-max max-w-full flex-col gap-4">
        {scope.years.length < 2 ? null : (
          <div className="flex justify-end">
            <Select onValueChange={(value) => onYearChange(Number(value))} value={String(year)}>
              <SelectTrigger aria-label={t("yearLabel")} className="w-24 data-[size=default]:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scope.years.map((entry) => (
                  <SelectItem key={entry} value={String(entry)}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div
          aria-label={t("gridLabel")}
          className={CALENDAR_UI.scrollerClass}
          role="region"
          tabIndex={0}
        >
          <div className="flex min-w-max gap-2">
            <div
              className="flex shrink-0 flex-col"
              style={{ ...CALENDAR_LAYOUT.gridGap, ...CALENDAR_LAYOUT.weekdayOffset }}
            >
              {Array.from({ length: CALENDAR.daysPerWeek }, (_, row) => (
                <span
                  aria-hidden
                  className="flex items-center text-[0.625rem] leading-none text-muted-foreground capitalize"
                  key={row}
                  style={CALENDAR_LAYOUT.cellBox}
                >
                  {CALENDAR_UI.weekdayLabelRows.some((visible) => visible === row)
                    ? weekdayLabel(row, locale)
                    : ""}
                </span>
              ))}
            </div>

            <div className="flex flex-col" style={CALENDAR_LAYOUT.labelGap}>
              <div className="relative" style={CALENDAR_LAYOUT.labelRow}>
                {monthLabelBoxes({ labels: grid.monthLabels, weekCount: grid.weeks.length }).map(
                  (box) => (
                    <span
                      className="absolute top-0 overflow-hidden text-center text-[0.6875rem] whitespace-nowrap text-muted-foreground"
                      key={box.monthStart}
                      style={{ left: `${box.leftPx}px`, width: `${box.widthPx}px` }}
                    >
                      {monthShortLabel(box.monthStart, locale)}
                    </span>
                  ),
                )}
              </div>

              <div className="flex" style={CALENDAR_LAYOUT.gridGap}>
                {grid.weeks.map((week, weekIndex) => (
                  <div className="flex flex-col" key={weekIndex} style={CALENDAR_LAYOUT.gridGap}>
                    {week.map((cell, dayIndex) =>
                      cell === null ? (
                        <span
                          aria-hidden
                          className="shrink-0"
                          key={dayIndex}
                          style={CALENDAR_LAYOUT.cellBox}
                        />
                      ) : (
                        <CalendarDay
                          cell={cell}
                          drilldown={drilldown}
                          isTruncated={isTruncated}
                          key={cell.date}
                          metric={metric}
                          truncatedNoticeId={truncatedNoticeId}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t(`legendLess.${metric}`)}</span>
          {CALENDAR.levelClass.map((className, level) => (
            <span
              aria-hidden
              className={`shrink-0 ${CALENDAR_UI.radiusClass} ${className}`}
              key={level}
              style={CALENDAR_LAYOUT.cellBox}
            />
          ))}
          <span>{t("legendMore")}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("relativeHint")}</p>
      </div>

      {grid.hasValues ? null : (
        <StatisticsSectionState kind="empty" title={t("empty.year", { year: String(year) })} />
      )}

      {coverageNote}
    </>
  );
}

function CalendarCoverageNote({ count }: { count: number }) {
  const t = useTranslations("delivery.statistics.calendar");

  if (count === 0) return null;

  return (
    <StatisticsDataQualityNote kind="partial">
      {t("coverageNote", { count })}
    </StatisticsDataQualityNote>
  );
}

function CalendarDay({
  cell,
  drilldown,
  isTruncated,
  metric,
  truncatedNoticeId,
}: {
  cell: CalendarCell;
  drilldown: StatisticsDrilldownContext;
  isTruncated: boolean;
  metric: CalendarMetric;
  truncatedNoticeId: string;
}) {
  const t = useTranslations("delivery.statistics.calendar");
  const locale = useLocale();

  const toneClass = `shrink-0 ${CALENDAR_UI.radiusClass} ${CALENDAR.levelClass[cell.level]}`;

  if (cell.value === 0) {
    return <span aria-hidden className={toneClass} style={CALENDAR_LAYOUT.cellBox} />;
  }

  const date = formatDateLong(cell.date, locale);
  const summary = t(`daySummary.${metric}`, {
    books: cell.booksCount,
    date,
    orders: cell.ordersCount,
  });

  const links = isTruncated
    ? []
    : statisticsDrilldownLinks({
        breakdown: cell.drilldown,
        context: drilldown,
        metricKind: STATISTICS_METRIC_KIND.countOrStatus,
        scope: { from: cell.date, kind: "order_date_range", to: cell.date },
      });

  const cellClass = `${toneClass} ${CALENDAR_UI.interactiveClass}`;
  const only = links.at(0);
  const summaryTooltip = (
    <TooltipContent>
      <CalendarDayDetails cell={cell} date={date} metric={metric} />
    </TooltipContent>
  );

  if (only === undefined) {
    return (
      <Tooltip>
        <TooltipTrigger
          aria-describedby={isTruncated ? truncatedNoticeId : undefined}
          aria-disabled
          aria-label={summary}
          className={`${cellClass} ${CALENDAR_UI.disabledClass}`}
          style={CALENDAR_LAYOUT.cellBox}
          type="button"
        />
        {summaryTooltip}
      </Tooltip>
    );
  }

  if (links.length === 1) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            aria-label={summary}
            className={`block ${cellClass}`}
            href={only.href}
            style={CALENDAR_LAYOUT.cellBox}
          />
        </TooltipTrigger>
        {summaryTooltip}
      </Tooltip>
    );
  }

  return (
    <CalendarDayMenu
      cellClass={cellClass}
      links={links}
      metric={metric}
      summary={summary}
      tooltip={summaryTooltip}
    />
  );
}

function CalendarDayDetails({
  cell,
  date,
  metric,
}: {
  cell: CalendarCell;
  date: string;
  metric: CalendarMetric;
}) {
  const t = useTranslations("delivery.statistics.calendar");
  const locale = useLocale();

  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{date}</span>
      <span>{t(`tooltipPrimary.${metric}`, { count: primaryCount(cell, metric) })}</span>
      <span className="opacity-80">
        {t(`tooltipSecondary.${metric}`, { count: secondaryCount(cell, metric) })}
      </span>
      {cell.totalsByCurrency.length === 0 ? (
        <span className="opacity-80">{t("tooltipMoneyMissing")}</span>
      ) : (
        <>
          <span className="pt-0.5 opacity-80">{t("tooltipMoney")}</span>
          <span className="tabular-nums">
            {formatCurrencyTotals(cell.totalsByCurrency, locale)}
          </span>
        </>
      )}
    </span>
  );
}

function CalendarDayMenu({
  cellClass,
  links,
  metric,
  summary,
  tooltip,
}: {
  cellClass: string;
  links: StatisticsDrilldownLink[];
  metric: CalendarMetric;
  summary: string;
  tooltip: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={summary}
            className={`cursor-pointer ${cellClass} ${isOpen ? CALENDAR_UI.activeClass : ""}`}
            style={CALENDAR_LAYOUT.cellBox}
            type="button"
          />
        </TooltipTrigger>
        {tooltip}
      </Tooltip>
      <StatisticsDrilldownMenuContent
        align="center"
        links={links}
        unit={metric === "books" ? "books" : "orders"}
      />
    </DropdownMenu>
  );
}

function monthLabelBoxes({
  labels,
  weekCount,
}: {
  labels: readonly CalendarMonthLabel[];
  weekCount: number;
}): CalendarMonthLabelBox[] {
  const soleLabel = labels.length === 1 ? labels.at(0) : undefined;

  if (soleLabel !== undefined) {
    const canvasWidthPx = weekCount * CALENDAR_LAYOUT.pitchPx - CALENDAR_UI.gapPx;
    const widthPx = Math.max(canvasWidthPx, CALENDAR_UI.minMonthLabelPx);

    return [{ leftPx: (canvasWidthPx - widthPx) / 2, monthStart: soleLabel.monthStart, widthPx }];
  }

  return labels
    .map((label, index) => ({
      leftPx: label.weekIndex * CALENDAR_LAYOUT.pitchPx,
      monthStart: label.monthStart,
      widthPx:
        ((labels[index + 1]?.weekIndex ?? weekCount) - label.weekIndex) * CALENDAR_LAYOUT.pitchPx -
        CALENDAR_UI.gapPx,
    }))
    .filter((box) => box.widthPx >= CALENDAR_UI.minMonthLabelPx);
}

function monthShortLabel(monthStart: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(parseISO(monthStart));
}

function primaryCount(cell: CalendarCell, metric: CalendarMetric): number {
  return metric === "books" ? cell.booksCount : cell.ordersCount;
}

function secondaryCount(cell: CalendarCell, metric: CalendarMetric): number {
  return metric === "books" ? cell.ordersCount : cell.booksCount;
}

function weekdayLabel(row: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
    addDays(parseISO(CALENDAR_UI.weekdayAnchorDate), row),
  );
}
