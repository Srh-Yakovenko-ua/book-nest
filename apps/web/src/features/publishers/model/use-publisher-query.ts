"use client";

import type { Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  PublishersControllerLibraryListGeography,
  PublishersControllerLibraryListOrder,
  PublishersControllerLibraryListSort,
  PublishersControllerLibraryListSource,
} from "@/shared/api/generated/model";

import type {
  LibraryPublishersParams,
  PublisherBooleanFilter,
  PublisherQueryState,
  PublishersViewMode,
} from "./publisher-query";

import {
  hasActivePublisherFilters,
  hasActivePublisherSearch,
  publisherQueryParsers,
  PUBLISHERS_FILTERS_RESET,
  toLibraryPublishersParams,
} from "./publisher-query";

export type UsePublisherQueryResult = {
  clearAll: () => void;
  clearFilters: () => void;
  clearSearch: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: LibraryPublishersParams;
  page: number;
  setGeography: (value: PublishersControllerLibraryListGeography) => void;
  setOrder: (value: PublishersControllerLibraryListOrder) => void;
  setPage: (value: number) => void;
  setSearch: (value: string) => void;
  setSort: (value: PublishersControllerLibraryListSort) => void;
  setSource: (value: PublishersControllerLibraryListSource) => void;
  setState: ReturnType<typeof useQueryStates<typeof publisherQueryParsers>>[1];
  setView: (value: PublishersViewMode) => void;
  state: PublisherQueryState;
  toggleBoolFilter: (filter: PublisherBooleanFilter, value: Nullable<boolean>) => void;
};

export function usePublisherQuery(): UsePublisherQueryResult {
  const [state, setState] = useQueryStates(publisherQueryParsers);

  const booleanSetters: Record<PublisherBooleanFilter, (value: Nullable<boolean>) => void> = {
    hasBooksToBuy: (value) => void setState({ hasBooksToBuy: value, page: null }),
    hasRatedBooks: (value) => void setState({ hasRatedBooks: value, page: null }),
    hasSeries: (value) => void setState({ hasSeries: value, page: null }),
  };

  return {
    clearAll: () => void setState({ search: null, ...PUBLISHERS_FILTERS_RESET }),
    clearFilters: () => void setState(PUBLISHERS_FILTERS_RESET),
    clearSearch: () => void setState({ page: null, search: null }),
    hasActiveFilters: hasActivePublisherFilters(state),
    hasActiveSearch: hasActivePublisherSearch(state),
    listParams: toLibraryPublishersParams(state),
    page: state.page,
    setGeography: (value) => void setState({ geography: value, page: null }),
    setOrder: (value) => void setState({ order: value, page: null }),
    setPage: (value) => void setState({ page: value }),
    setSearch: (value) => void setState({ page: null, search: value }),
    setSort: (value) => void setState({ page: null, sort: value }),
    setSource: (value) => void setState({ page: null, source: value }),
    setState,
    setView: (value) => void setState({ view: value }),
    state,
    toggleBoolFilter: (filter, value) => booleanSetters[filter](value),
  };
}
