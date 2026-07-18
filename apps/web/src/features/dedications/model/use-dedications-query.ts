"use client";

import type { DedicationFilter, DedicationSort } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { BooksControllerDedicationsParams } from "@/shared/api/generated/model";

import type { DedicationsQueryState } from "./dedications-query";

import {
  DEDICATIONS_FILTERS_RESET,
  dedicationsQueryParsers,
  hasActiveDedicationFilters,
  toDedicationsParams,
} from "./dedications-query";

export type UseDedicationsQueryResult = {
  clearFilters: () => void;
  hasActiveFilters: boolean;
  listParams: BooksControllerDedicationsParams;
  setFilter: (value: DedicationFilter) => void;
  setGenre: (value: string) => void;
  setPage: (value: number) => void;
  setSearch: (value: string) => void;
  setSort: (value: DedicationSort) => void;
  state: DedicationsQueryState;
};

export function useDedicationsQuery(): UseDedicationsQueryResult {
  const [state, setState] = useQueryStates(dedicationsQueryParsers);

  return {
    clearFilters: () => void setState(DEDICATIONS_FILTERS_RESET),
    hasActiveFilters: hasActiveDedicationFilters(state),
    listParams: toDedicationsParams(state),
    setFilter: (value) => void setState({ filter: value, page: null }),
    setGenre: (value) => void setState({ genre: value, page: null }),
    setPage: (value) => void setState({ page: value }),
    setSearch: (value) => void setState({ page: null, search: value }),
    setSort: (value) => void setState({ page: null, sort: value }),
    state,
  };
}
