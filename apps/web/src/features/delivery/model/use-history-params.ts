"use client";

import type { Nullable } from "@app/shared";

import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect } from "react";

import type { DeliveryReadControllerHistoryListSort } from "@/shared/api/generated/model";

import type {
  DeliveryHistoryAdvancedState,
  DeliveryHistoryListParams,
  DeliveryHistoryQueryState,
  DeliveryHistoryTab,
} from "./history-params";

import {
  canSortByHistoryTotal,
  comparesHistoryPrices,
  countActiveHistoryDimensions,
  DELIVERY_HISTORY_ADVANCED_RESET,
  deliveryHistoryParsers,
  deliveryHistoryRetiredParsers,
  hasActiveHistoryFilters,
  hasActiveHistorySearch,
  isKnownHistorySort,
  isKnownHistoryTab,
  resolveHistorySort,
  toDeliveryHistoryListParams,
} from "./history-params";

export type UseHistoryParamsResult = {
  advanced: DeliveryHistoryAdvancedState;
  advancedCount: number;
  applyAdvanced: (draft: DeliveryHistoryAdvancedState) => void;
  canSortByPrice: boolean;
  clearAdvanced: () => void;
  clearAll: () => void;
  clearSearch: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: DeliveryHistoryListParams;
  setSearch: (value: string) => void;
  setSort: (value: DeliveryReadControllerHistoryListSort) => void;
  setTab: (value: DeliveryHistoryTab) => void;
  sort: DeliveryReadControllerHistoryListSort;
  state: DeliveryHistoryQueryState;
  tab: DeliveryHistoryTab;
};

export function useHistoryParams(): UseHistoryParamsResult {
  const [state, setState] = useQueryStates(deliveryHistoryParsers);
  const [retired, setRetired] = useQueryStates(deliveryHistoryRetiredParsers);
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const rawSort = searchParams.get("sort");
  const hasRetiredTab = rawTab !== null && !isKnownHistoryTab(rawTab);
  const hasRetiredSort = rawSort !== null && !isKnownHistorySort(rawSort);
  const hasRetiredFilters = retired.hasTrackingNumber !== null || retired.hasTrackingUrl !== null;
  const sort = resolveHistorySort(state);
  const comparesUngatedPrices = comparesHistoryPrices(state.sort) && sort !== state.sort;

  useEffect(() => {
    if (hasRetiredTab) void setState({ tab: null });
  }, [hasRetiredTab, setState]);

  useEffect(() => {
    if (hasRetiredSort || comparesUngatedPrices) void setState({ sort: null });
  }, [comparesUngatedPrices, hasRetiredSort, setState]);

  useEffect(() => {
    if (!hasRetiredFilters) return;
    void setRetired({ hasTrackingNumber: null, hasTrackingUrl: null });
  }, [hasRetiredFilters, setRetired]);

  return {
    advanced: state,
    advancedCount: countActiveHistoryDimensions({ state, tab: state.tab }),
    applyAdvanced: (draft) => void setState(toAdvancedPatch(draft)),
    canSortByPrice: canSortByHistoryTotal(state),
    clearAdvanced: () => void setState({ ...DELIVERY_HISTORY_ADVANCED_RESET }),
    clearAll: () => void setState({ ...DELIVERY_HISTORY_ADVANCED_RESET, q: null }),
    clearSearch: () => void setState({ q: null }),
    hasActiveFilters: hasActiveHistoryFilters({ state, tab: state.tab }),
    hasActiveSearch: hasActiveHistorySearch(state),
    listParams: toDeliveryHistoryListParams({ ...state, sort }),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    setTab: (value) =>
      void setState({
        cancelledFrom: null,
        cancelledTo: null,
        receivedFrom: null,
        receivedTo: null,
        tab: value,
      }),
    sort,
    state,
    tab: state.tab,
  };
}

function emptyToNull(value: Nullable<string>): Nullable<string> {
  return value === null || value.trim() === "" ? null : value;
}

function toAdvancedPatch(draft: DeliveryHistoryAdvancedState) {
  return {
    booksMax: draft.booksMax,
    booksMin: draft.booksMin,
    cancelledFrom: emptyToNull(draft.cancelledFrom),
    cancelledTo: emptyToNull(draft.cancelledTo),
    currency: draft.currency.length === 0 ? null : draft.currency,
    from: emptyToNull(draft.from),
    priceMax: draft.priceMax,
    priceMin: draft.priceMin,
    receivedFrom: emptyToNull(draft.receivedFrom),
    receivedTo: emptyToNull(draft.receivedTo),
    service: draft.service.length === 0 ? null : draft.service,
    store: draft.store.length === 0 ? null : draft.store,
    to: emptyToNull(draft.to),
  };
}
