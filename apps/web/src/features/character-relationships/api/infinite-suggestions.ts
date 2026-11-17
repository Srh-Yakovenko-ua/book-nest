import type { Nullable } from "@app/shared";

type InfiniteSuggestionsQuery = {
  data: unknown;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isLoadingError: boolean;
  isPlaceholderData: boolean;
  refetch: () => Promise<unknown>;
};

type InfiniteSuggestionsStatus<TIdle extends string> =
  "empty" | "error" | "loading" | "results" | TIdle;

export function resolveInfiniteSuggestions<TIdle extends string>({
  debouncedTerm,
  idle,
  itemCount,
  query,
  term,
}: {
  debouncedTerm: string;
  idle: Nullable<TIdle>;
  itemCount: number;
  query: InfiniteSuggestionsQuery;
  term: string;
}) {
  const isStale = query.isPlaceholderData || debouncedTerm !== term;
  const isLoadMoreError = query.isFetchNextPageError && !query.isFetchingNextPage && !isStale;
  const hasNextPage = query.hasNextPage && !isStale && !isLoadMoreError;

  function toStatus(): InfiniteSuggestionsStatus<TIdle> {
    if (idle !== null) return idle;
    if (query.isLoadingError) return "error";
    if (query.data === undefined) return "loading";
    if (itemCount > 0 || hasNextPage || isLoadMoreError) return "results";
    return isStale ? "loading" : "empty";
  }

  const status = toStatus();

  return {
    fetchNextPage: () => {
      if (!hasNextPage || query.isFetchingNextPage) return;
      void query.fetchNextPage();
    },
    hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoadMoreError,
    isStale,
    retry: () => {
      if (isLoadMoreError) {
        void query.fetchNextPage();
        return;
      }
      if (status === "error") void query.refetch();
    },
    status,
  };
}
