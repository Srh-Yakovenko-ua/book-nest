"use client";

import { useQueryStates } from "nuqs";

import type {
  PublisherBooleanFilter,
  PublisherQueryState,
  PublishersAdvancedFilters,
  PublishersListQuery,
  PublishersQuickFilter,
  PublishersSort,
  PublishersViewMode,
} from "./publisher-query";

import {
  hasActivePublisherFilters,
  hasActivePublisherSearch,
  publisherQueryParsers,
  PUBLISHERS_CLEAR_ALL,
  PUBLISHERS_FILTERS_RESET,
  toPublishersAdvancedFilters,
  toPublishersAdvancedPatch,
  toPublishersListQuery,
} from "./publisher-query";

export type UsePublisherQueryResult = {
  advancedFilters: PublishersAdvancedFilters;
  applyAdvancedFilters: (filters: PublishersAdvancedFilters) => void;
  clearAll: () => void;
  clearBooleanFilter: (filter: PublisherBooleanFilter) => void;
  clearGeography: () => void;
  clearSearch: () => void;
  clearSource: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listQuery: PublishersListQuery;
  resetFilters: () => void;
  setQuickFilter: (value: PublishersQuickFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: PublishersSort) => void;
  setView: (value: PublishersViewMode) => void;
  state: PublisherQueryState;
};

export function usePublisherQuery(): UsePublisherQueryResult {
  const [state, setState] = useQueryStates(publisherQueryParsers);

  return {
    advancedFilters: toPublishersAdvancedFilters(state),
    applyAdvancedFilters: (filters) => void setState(toPublishersAdvancedPatch(filters)),
    clearAll: () => void setState(PUBLISHERS_CLEAR_ALL),
    clearBooleanFilter: (filter) => void setState({ [filter]: null }),
    clearGeography: () => void setState({ geography: null }),
    clearSearch: () => void setState({ q: null }),
    clearSource: () => void setState({ source: null }),
    hasActiveFilters: hasActivePublisherFilters(state),
    hasActiveSearch: hasActivePublisherSearch(state),
    listQuery: toPublishersListQuery(state),
    resetFilters: () => void setState(PUBLISHERS_FILTERS_RESET),
    setQuickFilter: (value) => void setState({ filter: value }),
    setSearch: (value) => void setState({ q: value === "" ? null : value }),
    setSort: (value) => void setState({ sort: value }),
    setView: (value) => void setState({ view: value }),
    state,
  };
}
