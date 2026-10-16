"use client";

import type { BookOrderStatisticsMeta, Nullable } from "@app/shared";

import { BookOrderStatisticsCompareModeSchema } from "@app/shared";
import { isAfter, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
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
import { LibraryActiveFilters } from "@/features/books/components/library-active-filters";
import { useWeekStartsOn } from "@/features/settings";
import { dateToIsoDay, isoDayToDate } from "@/lib/iso-day";

import type { StatisticsCustomRange } from "../../model/statistics-period";
import type { UseStatisticsParamsResult } from "../../model/use-statistics-params";

import { formatPeriodRange } from "../../model/statistics-format";
import {
  defaultStatisticsCompareMode,
  STATISTICS_PERIOD,
  STATISTICS_PERIOD_PRESETS,
} from "../../model/statistics-period";
import { useStatisticsFilterChips } from "../../model/use-statistics-filter-chips";
import { DeliveryStatisticsFilters } from "../delivery-statistics-filters";

const COMPARE_MODES = BookOrderStatisticsCompareModeSchema.options;

export function StatisticsToolbar({
  meta,
  params,
  stores,
}: {
  meta: Nullable<BookOrderStatisticsMeta>;
  params: UseStatisticsParamsResult;
  stores: readonly string[];
}) {
  const t = useTranslations("delivery.statistics.controls");
  const tPeriod = useTranslations("delivery.statistics.period");
  const locale = useLocale();
  const compareId = useId();
  const fromId = useId();
  const toId = useId();
  const rangeReversedId = useId();
  const weekStartsOn = useWeekStartsOn();
  const today = parseISO(params.today);
  const earliestDay = parseISO(STATISTICS_PERIOD.earliestCustomDay);
  const chips = useStatisticsFilterChips({
    onIncludeCancelledChange: params.setIncludeCancelled,
    onPatch: params.setFilters,
    state: params.state,
  });
  const isRangeReversed = isReversedRange({ from: params.state.from, to: params.state.to });

  const currentPeriod = meta?.currentPeriod ?? params.periodRange;
  const currentLabel = formatPeriodRange({
    from: currentPeriod.from,
    locale,
    to: currentPeriod.to,
  });
  const comparisonLabel =
    meta?.comparisonPeriod == null
      ? null
      : formatPeriodRange({
          from: meta.comparisonPeriod.from,
          locale,
          to: meta.comparisonPeriod.to,
        });

  return (
    <section aria-label={t("toolbarLabel")} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          onValueChange={(value) =>
            params.setPeriod(value as (typeof STATISTICS_PERIOD_PRESETS)[number])
          }
          value={params.state.period}
        >
          <SelectTrigger
            aria-label={tPeriod("label")}
            className="w-[13.5rem] data-[size=default]:h-9"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATISTICS_PERIOD_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {tPeriod(preset)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {params.state.period === "custom" ? (
          <div className="flex w-full flex-col gap-1 sm:w-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <DatePicker
                ariaLabel={tPeriod("from")}
                className="h-9 rounded-lg text-sm whitespace-nowrap sm:w-50"
                describedBy={isRangeReversed ? rangeReversedId : undefined}
                endMonth={today}
                id={fromId}
                invalid={isRangeReversed}
                onChange={(date) =>
                  params.setCustomRange({
                    from: date ? dateToIsoDay(date) : "",
                    to: params.state.to,
                  })
                }
                placeholder={tPeriod("from")}
                startMonth={earliestDay}
                value={isoDayToDate(params.state.from)}
                weekStartsOn={weekStartsOn}
              />
              <span className="hidden text-sm text-muted-foreground sm:inline">–</span>
              <DatePicker
                ariaLabel={tPeriod("to")}
                className="h-9 rounded-lg text-sm whitespace-nowrap sm:w-50"
                describedBy={isRangeReversed ? rangeReversedId : undefined}
                endMonth={today}
                id={toId}
                invalid={isRangeReversed}
                onChange={(date) =>
                  params.setCustomRange({
                    from: params.state.from,
                    to: date ? dateToIsoDay(date) : "",
                  })
                }
                placeholder={tPeriod("to")}
                startMonth={earliestDay}
                value={isoDayToDate(params.state.to)}
                weekStartsOn={weekStartsOn}
              />
            </div>
            {isRangeReversed ? (
              <p className="text-xs text-favorite" id={rangeReversedId} role="alert">
                {tPeriod("rangeReversed")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {params.hasActiveFilters ? (
            <Button onClick={params.clearFilters} size="sm" variant="ghost">
              {t("resetFilters")}
            </Button>
          ) : null}
          <DeliveryStatisticsFilters
            filterCount={params.filterCount}
            includeCancelled={params.state.includeCancelled}
            onApply={params.setFilters}
            onIncludeCancelledChange={params.setIncludeCancelled}
            onReset={params.clearFilters}
            state={params.state}
            stores={stores}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label
          className="flex items-center gap-2.5 text-sm font-medium text-foreground data-[disabled=true]:cursor-not-allowed data-[disabled=true]:text-muted-foreground"
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
          {t("compare")}
        </label>

        {params.canCompare ? null : (
          <Tooltip>
            <TooltipTrigger
              aria-label={t("compareUnavailable")}
              className="text-muted-foreground"
              type="button"
            >
              <UiIcon name="info" size={14} />
            </TooltipTrigger>
            <TooltipContent className="max-w-72">{t("compareUnavailable")}</TooltipContent>
          </Tooltip>
        )}

        {params.compareMode === null ? null : (
          <div className="flex items-center gap-2">
            <Label className="sr-only" htmlFor="statistics-compare-mode">
              {t("compareMode")}
            </Label>
            <Select
              onValueChange={(value) =>
                params.setCompareMode(value as (typeof COMPARE_MODES)[number])
              }
              value={params.compareMode}
            >
              <SelectTrigger
                className="w-[13rem] data-[size=default]:h-9"
                id="statistics-compare-mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPARE_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {t(`compareModes.${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <LibraryActiveFilters chips={chips} onClearAll={params.clearFilters} />

      <p className="text-sm text-muted-foreground">
        {currentLabel === null
          ? tPeriod("allTimeCaption")
          : tPeriod("caption", { range: currentLabel })}
        {comparisonLabel === null ? null : (
          <span className="ms-2">{tPeriod("comparisonCaption", { range: comparisonLabel })}</span>
        )}
      </p>
    </section>
  );
}

function isReversedRange({ from, to }: StatisticsCustomRange): boolean {
  const start = isoDayToDate(from);
  const end = isoDayToDate(to);
  return start !== undefined && end !== undefined && isAfter(start, end);
}
