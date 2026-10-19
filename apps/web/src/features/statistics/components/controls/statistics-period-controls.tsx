"use client";

import type { Nullable, ReadingStatisticsComparison, ReadingStatisticsPeriod } from "@app/shared";

import { READING_STATISTICS_CUSTOM_PERIOD_BOUNDS } from "@app/shared";
import { parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { YearPicker } from "@/components/ui/year-picker";
import { useWeekStartsOn } from "@/features/settings";
import { dateToIsoDay, isoDayToDate } from "@/lib/iso-day";

import type { UseStatisticsParamsResult } from "../../model/use-statistics-params";

import { formatDayLong, formatDayRange } from "../../model/statistics-format";
import {
  defaultStatisticsCompareMode,
  resolvedStatisticsYear,
  selectableYearBounds,
  STATISTICS_COMPARE_MODES,
  STATISTICS_PERIOD_KINDS,
} from "../../model/statistics-period";

export function StatisticsPeriodControls({
  comparison,
  params,
  period,
}: {
  comparison: Nullable<ReadingStatisticsComparison>;
  params: UseStatisticsParamsResult;
  period: Nullable<ReadingStatisticsPeriod>;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.period");
  const tCompare = useTranslations("statistics.compare");
  const compareId = useId();
  const compareModeId = useId();
  const yearId = useId();
  const fromId = useId();
  const toId = useId();
  const rangeIssueId = useId();
  const weekStartsOn = useWeekStartsOn();
  const hasRangeIssue = params.rangeIssue !== null && params.rangeIssue !== "incomplete";
  const rangeIssueDescription = params.rangeIssue === null ? undefined : rangeIssueId;
  const yearBounds = selectableYearBounds(params.today);
  const today = parseISO(params.today);
  const earliestDay = parseISO(READING_STATISTICS_CUSTOM_PERIOD_BOUNDS.earliestDay);

  const currentLabel =
    period === null ? null : formatDayRange({ from: period.from, locale, to: period.to });
  const comparisonLabel =
    comparison === null
      ? null
      : formatDayRange({ from: comparison.from, locale, to: comparison.to });

  return (
    <section aria-label={t("toolbarLabel")} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          onValueChange={(value) => {
            const kind = STATISTICS_PERIOD_KINDS.find((option) => option === value);
            if (kind !== undefined) params.setPeriod(kind);
          }}
          value={params.state.period}
        >
          <SelectTrigger aria-label={t("label")} className="w-[13.5rem] data-[size=default]:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATISTICS_PERIOD_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {params.state.period === "year" ? (
          <div className="w-32">
            <YearPicker
              ariaLabel={t("yearLabel")}
              clearLabel={t("yearClear")}
              id={yearId}
              max={yearBounds.max}
              min={yearBounds.min}
              nextLabel={t("yearNext")}
              onChange={(year) => params.setYear(year ?? yearBounds.max)}
              prevLabel={t("yearPrev")}
              value={resolvedStatisticsYear(params.state, params.today)}
            />
          </div>
        ) : null}

        {params.state.period === "custom" ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <DatePicker
              ariaLabel={t("from")}
              className="h-9 rounded-lg text-sm whitespace-nowrap sm:w-50"
              describedBy={rangeIssueDescription}
              endMonth={today}
              id={fromId}
              invalid={hasRangeIssue}
              onChange={(date) =>
                params.setCustomRange({
                  from: date ? dateToIsoDay(date) : "",
                  to: params.state.to,
                })
              }
              placeholder={t("from")}
              required
              startMonth={earliestDay}
              today={today}
              value={isoDayToDate(params.state.from)}
              weekStartsOn={weekStartsOn}
            />
            <span className="hidden text-sm text-muted-foreground sm:inline">–</span>
            <DatePicker
              ariaLabel={t("to")}
              className="h-9 rounded-lg text-sm whitespace-nowrap sm:w-50"
              describedBy={rangeIssueDescription}
              endMonth={today}
              id={toId}
              invalid={hasRangeIssue}
              onChange={(date) =>
                params.setCustomRange({
                  from: params.state.from,
                  to: date ? dateToIsoDay(date) : "",
                })
              }
              placeholder={t("to")}
              required
              startMonth={earliestDay}
              today={today}
              value={isoDayToDate(params.state.to)}
              weekStartsOn={weekStartsOn}
            />
          </div>
        ) : null}

        <div className="ms-auto flex flex-wrap items-center gap-3">
          <label
            className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground data-[disabled=true]:cursor-not-allowed data-[disabled=true]:text-muted-foreground"
            data-disabled={!params.canCompare}
            htmlFor={compareId}
          >
            <Switch
              checked={params.compareMode !== null}
              disabled={!params.canCompare}
              id={compareId}
              onCheckedChange={(checked) =>
                params.setCompareMode(
                  checked ? defaultStatisticsCompareMode(params.state.period) : null,
                )
              }
            />
            {tCompare("toggle")}
          </label>

          {params.canCompare ? null : (
            <Tooltip>
              <TooltipTrigger
                aria-label={tCompare("unavailable")}
                className="text-muted-foreground"
                type="button"
              >
                <UiIcon name="info" size={14} />
              </TooltipTrigger>
              <TooltipContent className="max-w-72">{tCompare("unavailable")}</TooltipContent>
            </Tooltip>
          )}

          {params.compareMode === null ? null : (
            <div className="flex items-center gap-2">
              <Label className="sr-only" htmlFor={compareModeId}>
                {tCompare("mode")}
              </Label>
              <Select
                onValueChange={(value) => {
                  const mode = STATISTICS_COMPARE_MODES.find((option) => option === value);
                  if (mode !== undefined) params.setCompareMode(mode);
                }}
                value={params.compareMode}
              >
                <SelectTrigger className="w-[14rem] data-[size=default]:h-9" id={compareModeId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATISTICS_COMPARE_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {tCompare(`modes.${mode}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {params.rangeIssue === null ? null : (
        <p
          className={hasRangeIssue ? "text-xs text-favorite" : "text-xs text-muted-foreground"}
          id={rangeIssueId}
          role={hasRangeIssue ? "alert" : "status"}
        >
          {t(`issues.${params.rangeIssue}`, {
            earliest: formatDayLong(READING_STATISTICS_CUSTOM_PERIOD_BOUNDS.earliestDay, locale),
            maxDays: READING_STATISTICS_CUSTOM_PERIOD_BOUNDS.maxDays,
          })}
        </p>
      )}

      {period === null ? null : (
        <p className="text-sm text-muted-foreground">
          {currentLabel === null ? t("allTimeCaption") : t("caption", { range: currentLabel })}
          {comparisonLabel === null ? null : (
            <span className="ms-2">{t("comparisonCaption", { range: comparisonLabel })}</span>
          )}
        </p>
      )}
    </section>
  );
}
