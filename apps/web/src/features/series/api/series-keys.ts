import type { SeriesControllerSearchParams } from "@/shared/api/generated/model";

export type SeriesListParams = SeriesControllerSearchParams & { pageSize: number };

const SERIES_ROOT = "/api/series";

export const seriesKeys = {
  detail: (id: string) => [SERIES_ROOT, "detail", id] as const,
  list: (params: SeriesListParams) => [SERIES_ROOT, "list", params] as const,
  overview: [SERIES_ROOT, "overview"] as const,
  root: [SERIES_ROOT] as const,
};
