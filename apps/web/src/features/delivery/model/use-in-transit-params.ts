"use client";

import type { Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  DeliveryReadControllerInTransitListFilter,
  DeliveryReadControllerInTransitListSort,
} from "@/shared/api/generated/model";

import type {
  DeliveryAdvancedState,
  DeliveryListParams,
  DeliveryQueryState,
} from "./in-transit-params";

import {
  countActiveDeliveryDimensions,
  DELIVERY_ADVANCED_RESET,
  deliveryQueryParsers,
  hasActiveDeliveryFilters,
  hasActiveDeliverySearch,
  toDeliveryListParams,
} from "./in-transit-params";

export type UseInTransitParamsResult = {
  advancedCount: number;
  applyAdvanced: (draft: DeliveryAdvancedState) => void;
  clearAll: () => void;
  clearFilters: () => void;
  clearSearch: () => void;
  filter: DeliveryReadControllerInTransitListFilter;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: DeliveryListParams;
  setFilter: (value: DeliveryReadControllerInTransitListFilter) => void;
  setFilterAndClearSearch: (value: DeliveryReadControllerInTransitListFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: DeliveryReadControllerInTransitListSort) => void;
  sort: DeliveryReadControllerInTransitListSort;
  state: DeliveryQueryState;
};

export function useInTransitParams(): UseInTransitParamsResult {
  const [state, setState] = useQueryStates(deliveryQueryParsers);

  return {
    advancedCount: countActiveDeliveryDimensions(state),
    applyAdvanced: (draft) => void setState(toAdvancedPatch(draft)),
    clearAll: () => void setState({ ...DELIVERY_ADVANCED_RESET, filter: null, q: null }),
    clearFilters: () => void setState({ ...DELIVERY_ADVANCED_RESET, filter: null }),
    clearSearch: () => void setState({ q: null }),
    filter: state.filter,
    hasActiveFilters: hasActiveDeliveryFilters(state),
    hasActiveSearch: hasActiveDeliverySearch(state),
    listParams: toDeliveryListParams(state),
    setFilter: (value) => void setState({ filter: value }),
    setFilterAndClearSearch: (value) => void setState({ filter: value, q: null }),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    sort: state.sort,
    state,
  };
}

function emptyToNull(value: Nullable<string>): Nullable<string> {
  return value === null || value.trim() === "" ? null : value;
}

function toAdvancedPatch(draft: DeliveryAdvancedState) {
  return {
    booksMax: draft.booksMax,
    booksMin: draft.booksMin,
    currency: draft.currency.length === 0 ? null : draft.currency,
    expectedFrom: emptyToNull(draft.expectedFrom),
    expectedTo: emptyToNull(draft.expectedTo),
    orderedFrom: emptyToNull(draft.orderedFrom),
    orderedTo: emptyToNull(draft.orderedTo),
    priceMax: draft.priceMax,
    priceMin: draft.priceMin,
    service: draft.service.length === 0 ? null : draft.service,
    store: draft.store.length === 0 ? null : draft.store,
    structure: draft.structure.length === 0 ? null : draft.structure,
  };
}
