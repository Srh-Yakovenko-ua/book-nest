"use client";

import { useQueryStates } from "nuqs";

import type {
  DeliveryControllerHistoryListSort,
  DeliveryControllerHistoryListTab,
} from "@/shared/api/generated/model";

import type { DeliveryHistoryListParams, DeliveryHistoryQueryState } from "./history-params";

import {
  deliveryHistoryParsers,
  hasActiveHistoryFilters,
  hasActiveHistorySearch,
  historyFilterCount,
  toDeliveryHistoryListParams,
} from "./history-params";

export type HistoryFilterPatch = Partial<
  Pick<
    DeliveryHistoryQueryState,
    | "currency"
    | "from"
    | "hasTrackingNumber"
    | "hasTrackingUrl"
    | "priceMax"
    | "priceMin"
    | "service"
    | "store"
    | "to"
  >
>;

export type UseHistoryParamsResult = {
  clearAll: () => void;
  clearFilters: () => void;
  clearSearch: () => void;
  filterCount: number;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: DeliveryHistoryListParams;
  setFilters: (patch: HistoryFilterPatch) => void;
  setSearch: (value: string) => void;
  setSort: (value: DeliveryControllerHistoryListSort) => void;
  setTab: (value: DeliveryControllerHistoryListTab) => void;
  sort: DeliveryControllerHistoryListSort;
  state: DeliveryHistoryQueryState;
  tab: DeliveryControllerHistoryListTab;
};

export function useHistoryParams(): UseHistoryParamsResult {
  const [state, setState] = useQueryStates(deliveryHistoryParsers);

  return {
    clearAll: () =>
      void setState({
        currency: null,
        from: null,
        hasTrackingNumber: null,
        hasTrackingUrl: null,
        priceMax: null,
        priceMin: null,
        q: null,
        service: null,
        store: null,
        tab: null,
        to: null,
      }),
    clearFilters: () =>
      void setState({
        currency: null,
        from: null,
        hasTrackingNumber: null,
        hasTrackingUrl: null,
        priceMax: null,
        priceMin: null,
        service: null,
        store: null,
        to: null,
      }),
    clearSearch: () => void setState({ q: null }),
    filterCount: historyFilterCount(state),
    hasActiveFilters: hasActiveHistoryFilters(state),
    hasActiveSearch: hasActiveHistorySearch(state),
    listParams: toDeliveryHistoryListParams(state),
    setFilters: (patch) => void setState(patch),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    setTab: (value) => void setState({ tab: value }),
    sort: state.sort,
    state,
    tab: state.tab,
  };
}
