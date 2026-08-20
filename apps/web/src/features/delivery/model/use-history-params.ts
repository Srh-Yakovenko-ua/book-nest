"use client";

import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect } from "react";

import type { DeliveryReadControllerHistoryListSort } from "@/shared/api/generated/model";

import type {
  DeliveryHistoryListParams,
  DeliveryHistoryQueryState,
  DeliveryHistoryTab,
} from "./history-params";

import {
  comparesHistoryPrices,
  DELIVERY_HISTORY_SORT_DEFAULT,
  deliveryHistoryParsers,
  hasActiveHistoryFilters,
  hasActiveHistorySearch,
  historyFilterCount,
  isKnownHistorySort,
  isKnownHistoryTab,
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
  canSortByPrice: boolean;
  clearAll: () => void;
  clearFilters: () => void;
  clearSearch: () => void;
  filterCount: number;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: DeliveryHistoryListParams;
  setFilters: (patch: HistoryFilterPatch) => void;
  setSearch: (value: string) => void;
  setSort: (value: DeliveryReadControllerHistoryListSort) => void;
  setTab: (value: DeliveryHistoryTab) => void;
  sort: DeliveryReadControllerHistoryListSort;
  state: DeliveryHistoryQueryState;
  tab: DeliveryHistoryTab;
};

export function useHistoryParams(): UseHistoryParamsResult {
  const [state, setState] = useQueryStates(deliveryHistoryParsers);
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const rawSort = searchParams.get("sort");
  const hasRetiredTab = rawTab !== null && !isKnownHistoryTab(rawTab);
  const hasRetiredSort = rawSort !== null && !isKnownHistorySort(rawSort);
  const canSortByPrice = state.currency !== null;
  const comparesUngatedPrices = comparesHistoryPrices(state.sort) && !canSortByPrice;
  const sort = comparesUngatedPrices ? DELIVERY_HISTORY_SORT_DEFAULT : state.sort;

  useEffect(() => {
    if (hasRetiredTab) void setState({ tab: null });
  }, [hasRetiredTab, setState]);

  useEffect(() => {
    if (hasRetiredSort || comparesUngatedPrices) void setState({ sort: null });
  }, [comparesUngatedPrices, hasRetiredSort, setState]);

  return {
    canSortByPrice,
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
    listParams: toDeliveryHistoryListParams({ ...state, sort }),
    setFilters: (patch) => void setState(patch),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    setTab: (value) => void setState({ tab: value }),
    sort,
    state,
    tab: state.tab,
  };
}
