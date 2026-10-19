import type {
  SeriesCharactersControllerListParams,
  SeriesControllerSearchParams,
} from "@/shared/api/generated/model";

export type SeriesListParams = SeriesControllerSearchParams & { pageSize: number };

const SERIES_ROOT = "/api/series";

export const seriesKeys = {
  characters: (seriesId: string, params: SeriesCharactersControllerListParams) =>
    [SERIES_ROOT, "characters", seriesId, params] as const,
  defaultReadingContext: (seriesId: string) =>
    [SERIES_ROOT, "reading-context", seriesId, "default"] as const,
  detail: (id: string) => [SERIES_ROOT, "detail", id] as const,
  list: (params: SeriesListParams) => [SERIES_ROOT, "list", params] as const,
  overview: [SERIES_ROOT, "overview"] as const,
  picker: (params: SeriesListParams) => [SERIES_ROOT, "picker", params] as const,
  root: [SERIES_ROOT] as const,
};
