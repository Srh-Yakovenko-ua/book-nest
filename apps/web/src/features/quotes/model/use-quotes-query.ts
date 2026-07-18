"use client";

import type { Nullable, QuoteFilter, QuoteSort, QuotesQuery } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { QuotesQueryState } from "./quotes-query";

import {
  hasActiveQuotesFilters,
  QUOTES_FILTERS_RESET,
  quotesQueryParsers,
  toQuotesListParams,
} from "./quotes-query";

export type UseQuotesQueryResult = {
  clearFilters: () => void;
  hasActiveFilters: boolean;
  listParams: QuotesQuery;
  setBookId: (value: Nullable<string>) => void;
  setFilter: (value: QuoteFilter) => void;
  setPage: (value: number) => void;
  setSearch: (value: string) => void;
  setSort: (value: QuoteSort) => void;
  state: QuotesQueryState;
};

export function useQuotesQuery(): UseQuotesQueryResult {
  const [state, setState] = useQueryStates(quotesQueryParsers);

  return {
    clearFilters: () => void setState(QUOTES_FILTERS_RESET),
    hasActiveFilters: hasActiveQuotesFilters(state),
    listParams: toQuotesListParams(state),
    setBookId: (bookId) => void setState({ bookId, pageNumber: null }),
    setFilter: (filter) => void setState({ filter, pageNumber: null }),
    setPage: (pageNumber) => void setState({ pageNumber }),
    setSearch: (q) => void setState({ pageNumber: null, q }),
    setSort: (sort) => void setState({ pageNumber: null, sort }),
    state,
  };
}
