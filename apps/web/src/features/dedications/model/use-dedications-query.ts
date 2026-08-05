"use client";

import type { DedicationFilter, DedicationSort } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  DedicationsListParams,
  DedicationsQueryState,
  DedicationView,
} from "./dedications-query";

import {
  DEDICATIONS_FILTERS_RESET,
  dedicationsQueryParsers,
  hasActiveDedicationFilters,
  toDedicationsParams,
} from "./dedications-query";

export type UseDedicationsQueryResult = {
  clearFilters: () => void;
  hasActiveFilters: boolean;
  listParams: DedicationsListParams;
  setFilter: (value: DedicationFilter) => void;
  setGenre: (value: string) => void;
  setSearch: (value: string) => void;
  setSort: (value: DedicationSort) => void;
  setView: (value: DedicationView) => void;
  state: DedicationsQueryState;
};

export function useDedicationsQuery(): UseDedicationsQueryResult {
  const [state, setState] = useQueryStates(dedicationsQueryParsers);

  return {
    clearFilters: () => void setState(DEDICATIONS_FILTERS_RESET),
    hasActiveFilters: hasActiveDedicationFilters(state),
    listParams: toDedicationsParams(state),
    setFilter: (value) => void setState({ filter: value }),
    setGenre: (value) => void setState({ genre: value }),
    setSearch: (value) => void setState({ search: value }),
    setSort: (value) => void setState({ sort: value }),
    setView: (value) => void setState({ view: value }),
    state,
  };
}
