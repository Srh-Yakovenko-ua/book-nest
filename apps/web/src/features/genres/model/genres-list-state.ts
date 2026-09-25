import type { GenreStatsView } from "@app/shared";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

export type GenresEmptyReason = "filters" | "library" | "search";

export type GenresListSnapshot = {
  data: undefined | { pages: { items: GenreStatsView[] }[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
};

export type GenresListState =
  | {
      genres: GenreStatsView[];
      isRefreshing: boolean;
      kind: "ready";
      nextPage: InfiniteScrollState;
    }
  | { kind: "empty"; reason: GenresEmptyReason }
  | { kind: "error" }
  | { kind: "loading" };

type GenresListStateInput = {
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  list: GenresListSnapshot;
};

export function genresListState({
  hasActiveFilters,
  hasActiveSearch,
  list,
}: GenresListStateInput): GenresListState {
  if (list.data === undefined) return list.isPending ? { kind: "loading" } : { kind: "error" };

  const genres = list.data.pages.flatMap((page) => page.items);

  if (genres.length === 0) {
    if (list.isPlaceholderData) return { kind: "loading" };
    return { kind: "empty", reason: emptyReason({ hasActiveFilters, hasActiveSearch }) };
  }

  return {
    genres,
    isRefreshing: list.isPlaceholderData,
    kind: "ready",
    nextPage: list.isPlaceholderData ? "none" : nextPageState(list),
  };
}

function emptyReason({
  hasActiveFilters,
  hasActiveSearch,
}: Omit<GenresListStateInput, "list">): GenresEmptyReason {
  if (hasActiveSearch) return "search";
  if (hasActiveFilters) return "filters";
  return "library";
}

function nextPageState(list: GenresListSnapshot): InfiniteScrollState {
  if (list.isFetchingNextPage) return "loading";
  if (list.isFetchNextPageError) return "error";
  if (list.hasNextPage) return "idle";
  return "none";
}
