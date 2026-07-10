"use client";

import { useQueryStates } from "nuqs";

import type { DeliveryControllerStatisticsParams } from "@/shared/api/generated/model";

import type { DeliveryStatisticsQueryState } from "./statistics-params";

import {
  deliveryStatisticsParsers,
  hasActiveStatisticsFilters,
  statisticsFilterCount,
  toDeliveryStatisticsParams,
} from "./statistics-params";

export type StatisticsFilterPatch = Partial<
  Pick<DeliveryStatisticsQueryState, "currency" | "from" | "status" | "store" | "to">
>;

export type UseStatisticsParamsResult = {
  clearFilters: () => void;
  filterCount: number;
  hasActiveFilters: boolean;
  queryParams: DeliveryControllerStatisticsParams;
  setFilters: (patch: StatisticsFilterPatch) => void;
  setIncludeCancelled: (value: boolean) => void;
  state: DeliveryStatisticsQueryState;
};

export function useStatisticsParams(): UseStatisticsParamsResult {
  const [state, setState] = useQueryStates(deliveryStatisticsParsers);

  return {
    clearFilters: () =>
      void setState({ currency: null, from: null, status: null, store: null, to: null }),
    filterCount: statisticsFilterCount(state),
    hasActiveFilters: hasActiveStatisticsFilters(state),
    queryParams: toDeliveryStatisticsParams(state),
    setFilters: (patch) => void setState(patch),
    setIncludeCancelled: (value) => void setState({ includeCancelled: value }),
    state,
  };
}
