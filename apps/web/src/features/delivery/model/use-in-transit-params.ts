"use client";

import { useQueryStates } from "nuqs";

import type {
  DeliveryReadControllerInTransitListFilter,
  DeliveryReadControllerInTransitListSort,
} from "@/shared/api/generated/model";

import type { DeliveryListParams, DeliveryQueryState } from "./in-transit-params";

import {
  deliveryQueryParsers,
  hasActiveDeliveryFilters,
  hasActiveDeliverySearch,
  toDeliveryListParams,
} from "./in-transit-params";

export type UseInTransitParamsResult = {
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
    clearAll: () => void setState({ filter: null, q: null }),
    clearFilters: () => void setState({ filter: null }),
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
