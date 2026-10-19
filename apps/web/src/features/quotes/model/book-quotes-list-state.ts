import type { QuoteView } from "@app/shared";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

export type BookQuotesEmptyReason = "book" | "filters" | "search";

export type BookQuotesListState =
  | { kind: "empty"; reason: BookQuotesEmptyReason }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "ready"; nextPage: InfiniteScrollState; quotes: QuoteView[] };

type BookQuotesListSnapshot = {
  data: undefined | { pages: { items: QuoteView[] }[] };
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
};

type BookQuotesListStateInput = {
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  list: BookQuotesListSnapshot;
};

export function bookQuotesListState({
  hasActiveFilters,
  hasActiveSearch,
  list,
}: BookQuotesListStateInput): BookQuotesListState {
  if (list.isPlaceholderData) return { kind: "loading" };
  if (list.data === undefined) return list.isPending ? { kind: "loading" } : { kind: "error" };

  const quotes = list.data.pages.flatMap((page) => page.items);

  if (quotes.length === 0) {
    return { kind: "empty", reason: emptyReason({ hasActiveFilters, hasActiveSearch }) };
  }

  return { kind: "ready", nextPage: nextPageState(list), quotes };
}

function emptyReason({
  hasActiveFilters,
  hasActiveSearch,
}: Omit<BookQuotesListStateInput, "list">): BookQuotesEmptyReason {
  if (hasActiveSearch) return "search";
  if (hasActiveFilters) return "filters";
  return "book";
}

function nextPageState(list: BookQuotesListSnapshot): InfiniteScrollState {
  if (list.isFetchingNextPage) return "loading";
  if (list.isFetchNextPageError) return "error";
  if (!list.hasNextPage) return "none";
  return list.isFetching ? "loading" : "idle";
}
