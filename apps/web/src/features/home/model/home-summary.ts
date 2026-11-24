export type HomeLibraryCountKey = keyof HomeLibraryCounts;

export type HomeLibraryCounts = {
  favorites: number;
  finished: number;
  reading: number;
  total: number;
};

export type HomeSummaryState =
  | { counts: HomeLibraryCounts; isStale: boolean; kind: "ready" }
  | { kind: "error" }
  | { kind: "loading" };

type SummaryQuery = {
  data: undefined | { summary: HomeLibraryCounts };
  isError: boolean;
};

export const HOME_LIBRARY_COUNT_KEYS = [
  "total",
  "reading",
  "finished",
  "favorites",
] as const satisfies readonly HomeLibraryCountKey[];

export function homeSummaryState(query: SummaryQuery): HomeSummaryState {
  if (query.data === undefined) return query.isError ? { kind: "error" } : { kind: "loading" };

  const { favorites, finished, reading, total } = query.data.summary;
  return {
    counts: { favorites, finished, reading, total },
    isStale: query.isError,
    kind: "ready",
  };
}
