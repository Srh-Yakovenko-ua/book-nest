"use client";

import type { BookOrderStatisticsCompareMode, Currency, Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { BookOrdersControllerStatisticsParams } from "@/shared/api/generated/model";

import type { DeliveryStatisticsQueryState } from "./statistics-params";
import type {
  StatisticsCustomRange,
  StatisticsPeriodPreset,
  StatisticsPeriodRange,
} from "./statistics-period";

import {
  deliveryStatisticsParsers,
  hasActiveStatisticsFilters,
  resolveStatisticsCompareMode,
  statisticsFilterCount,
  statisticsPeriodRange,
  toDeliveryStatisticsParams,
} from "./statistics-params";
import {
  canCompareStatisticsPeriod,
  defaultStatisticsCompareMode,
  resolveStatisticsPeriod,
  todayIsoDay,
} from "./statistics-period";

export type StatisticsFilterPatch = Partial<
  Pick<DeliveryStatisticsQueryState, "currency" | "status" | "store">
>;

export type UseStatisticsParamsResult = {
  canCompare: boolean;
  clearFilters: () => void;
  compareMode: Nullable<BookOrderStatisticsCompareMode>;
  filterCount: number;
  hasActiveFilters: boolean;
  periodRange: StatisticsPeriodRange;
  queryParams: BookOrdersControllerStatisticsParams;
  setCompareMode: (mode: Nullable<BookOrderStatisticsCompareMode>) => void;
  setCustomRange: (range: StatisticsCustomRange) => void;
  setFilters: (patch: StatisticsFilterPatch) => void;
  setIncludeCancelled: (value: boolean) => void;
  setMoneyCurrency: (currency: Currency) => void;
  setPeriod: (preset: StatisticsPeriodPreset) => void;
  state: DeliveryStatisticsQueryState;
  today: string;
};

export function useStatisticsParams(): UseStatisticsParamsResult {
  const [state, setState] = useQueryStates(deliveryStatisticsParsers);
  const today = todayIsoDay();
  const periodRange = statisticsPeriodRange(state, today);

  return {
    canCompare: canCompareStatisticsPeriod(periodRange),
    clearFilters: () => void setState({ currency: null, status: null, store: null }),
    compareMode: resolveStatisticsCompareMode(state, periodRange),
    filterCount: statisticsFilterCount(state),
    hasActiveFilters: hasActiveStatisticsFilters(state),
    periodRange,
    queryParams: toDeliveryStatisticsParams(state, today),
    setCompareMode: (mode) => void setState({ compare: mode }),
    setCustomRange: (range) => void setState({ from: range.from, period: "custom", to: range.to }),
    setFilters: (patch) => void setState(patch),
    setIncludeCancelled: (value) => void setState({ includeCancelled: value }),
    setMoneyCurrency: (money) => void setState({ money }),
    setPeriod: (preset) =>
      void setState({
        compare: nextCompareMode({ compare: state.compare, preset, state, today }),
        from: preset === "custom" ? state.from : null,
        period: preset,
        to: preset === "custom" ? state.to : null,
      }),
    state,
    today,
  };
}

function nextCompareMode({
  compare,
  preset,
  state,
  today,
}: {
  compare: Nullable<BookOrderStatisticsCompareMode>;
  preset: StatisticsPeriodPreset;
  state: DeliveryStatisticsQueryState;
  today: string;
}): Nullable<BookOrderStatisticsCompareMode> {
  if (compare === null) return null;

  const range = resolveStatisticsPeriod({
    custom: { from: state.from, to: state.to },
    preset,
    today,
  });
  if (!canCompareStatisticsPeriod(range)) return null;

  return defaultStatisticsCompareMode(preset);
}
