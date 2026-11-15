import type { QueryClient } from "@tanstack/react-query";

import type {
  SeriesCharactersControllerListParams,
  SeriesControllerFavoriteContinuationsParams,
  SeriesControllerSearchParams,
} from "@/shared/api/generated/model";

import { matchesApiRoot } from "@/lib/query-keys";

export type SeriesListParams = SeriesControllerSearchParams & { pageSize: number };

const SERIES_ROOT = "/api/series";

export const seriesKeys = {
  characters: (seriesId: string, params: SeriesCharactersControllerListParams) =>
    [...seriesKeys.charactersScope(seriesId), params] as const,
  charactersScope: (seriesId: string) => [SERIES_ROOT, "characters", seriesId] as const,
  defaultReadingContext: (seriesId: string) =>
    [SERIES_ROOT, "reading-context", seriesId, "default"] as const,
  detail: (id: string) => [SERIES_ROOT, "detail", id] as const,
  favoriteContinuations: (params: SeriesControllerFavoriteContinuationsParams) =>
    [`${SERIES_ROOT}/favorite-continuations`, params] as const,
  list: (params: SeriesListParams) => [SERIES_ROOT, "list", params] as const,
  orderCheckPreference: (seriesId: string) =>
    [`${SERIES_ROOT}/${seriesId}/order-check-preference`] as const,
  overview: [SERIES_ROOT, "overview"] as const,
  picker: (params: SeriesListParams) => [SERIES_ROOT, "picker", params] as const,
  root: [SERIES_ROOT] as const,
  search: ({ authorIds, search }: { authorIds: readonly string[]; search: string }) =>
    [SERIES_ROOT, "search", search, authorIds] as const,
};

export const matchesSeriesKey = matchesApiRoot(SERIES_ROOT);

export function invalidateSeriesQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ predicate: matchesSeriesKey });
}
