import type { QuoteSort } from "@app/shared";

import { QuoteSearchScopeSchema } from "@app/shared";
import { type inferParserType, parseAsStringLiteral } from "nuqs/server";

import type { QuotesFacetsParams, QuotesListParams } from "./quotes-query";

import { QUOTES_FILTER_DEFAULT, quotesQueryParsers } from "./quotes-query";

export const BOOK_QUOTES_TAB = {
  pageSize: 20,
  searchIn: QuoteSearchScopeSchema.enum.quotes,
  sortDefault: "page",
  sortOptions: ["page", "newest", "oldest"] as const satisfies readonly QuoteSort[],
} as const;

export type BookQuotesTabSort = (typeof BOOK_QUOTES_TAB.sortOptions)[number];

export const BOOK_QUOTES_TAB_PARSERS = {
  quoteFilter: quotesQueryParsers.filter,
  quoteQ: quotesQueryParsers.q,
  quoteSort: parseAsStringLiteral(BOOK_QUOTES_TAB.sortOptions).withDefault(
    BOOK_QUOTES_TAB.sortDefault,
  ),
};

export type BookQuotesTabState = inferParserType<typeof BOOK_QUOTES_TAB_PARSERS>;

type BookQuotesTabResetPatch = Partial<Record<keyof BookQuotesTabState, null>>;

export const BOOK_QUOTES_TAB_RESET = {
  filters: { quoteFilter: null },
  search: { quoteQ: null },
} satisfies Record<string, BookQuotesTabResetPatch>;

export function committedBookQuotesSearch(state: BookQuotesTabState): string {
  return state.quoteQ.trim();
}

export function hasActiveBookQuotesFilters(state: BookQuotesTabState): boolean {
  return state.quoteFilter !== QUOTES_FILTER_DEFAULT;
}

export function toBookQuotesFacetsParams(
  bookId: string,
  state: BookQuotesTabState,
): QuotesFacetsParams {
  const search = committedBookQuotesSearch(state);

  return {
    book: [bookId],
    searchIn: BOOK_QUOTES_TAB.searchIn,
    ...(search === "" ? {} : { q: search }),
  };
}

export function toBookQuotesListParams(
  bookId: string,
  state: BookQuotesTabState,
): QuotesListParams {
  return {
    ...toBookQuotesFacetsParams(bookId, state),
    filter: state.quoteFilter,
    pageSize: BOOK_QUOTES_TAB.pageSize,
    sort: state.quoteSort,
  };
}

export function toBookQuotesTabSort(value: string): BookQuotesTabSort {
  return (
    BOOK_QUOTES_TAB.sortOptions.find((option) => option === value) ?? BOOK_QUOTES_TAB.sortDefault
  );
}
