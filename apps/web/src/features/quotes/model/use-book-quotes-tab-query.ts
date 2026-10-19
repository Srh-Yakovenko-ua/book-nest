"use client";

import type { QuoteFilter } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { BookQuotesTabSort, BookQuotesTabState } from "./book-quotes-tab-query";
import type { QuotesFacetsParams, QuotesListParams } from "./quotes-query";

import {
  BOOK_QUOTES_TAB_PARSERS,
  BOOK_QUOTES_TAB_RESET,
  committedBookQuotesSearch,
  hasActiveBookQuotesFilters,
  toBookQuotesFacetsParams,
  toBookQuotesListParams,
} from "./book-quotes-tab-query";

export type UseBookQuotesTabQueryResult = {
  clearFilters: () => void;
  clearSearch: () => void;
  facetsParams: QuotesFacetsParams;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: QuotesListParams;
  setFilter: (value: QuoteFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: BookQuotesTabSort) => void;
  state: BookQuotesTabState;
};

export function useBookQuotesTabQuery(bookId: string): UseBookQuotesTabQueryResult {
  const [state, setState] = useQueryStates(BOOK_QUOTES_TAB_PARSERS);

  return {
    clearFilters: () => void setState(BOOK_QUOTES_TAB_RESET.filters),
    clearSearch: () => void setState(BOOK_QUOTES_TAB_RESET.search),
    facetsParams: toBookQuotesFacetsParams(bookId, state),
    hasActiveFilters: hasActiveBookQuotesFilters(state),
    hasActiveSearch: committedBookQuotesSearch(state) !== "",
    listParams: toBookQuotesListParams(bookId, state),
    setFilter: (quoteFilter) => void setState({ quoteFilter }),
    setSearch: (quoteQ) => void setState({ quoteQ }),
    setSort: (quoteSort) => void setState({ quoteSort }),
    state,
  };
}
