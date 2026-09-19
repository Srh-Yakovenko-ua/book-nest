import { PaginatedSeriesSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { seriesControllerSearch } from "@/shared/api/generated/endpoints/series/series";
import { SeriesControllerSearchSort } from "@/shared/api/generated/model";

import type { SeriesListParams } from "./series-keys";
import type { SeriesPage } from "./use-series-list";

import { seriesKeys } from "./series-keys";

const SERIES_PICKER_QUERY = {
  pageSize: 20,
  sort: SeriesControllerSearchSort.name_asc,
} as const;

export function useSeriesPickerOptions(search: string) {
  const trimmed = search.trim();
  const params: SeriesListParams = {
    ...SERIES_PICKER_QUERY,
    ...(trimmed === "" ? {} : { search: trimmed }),
  };

  return useInfiniteQuery({
    getNextPageParam: (lastPage: SeriesPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<SeriesPage> =>
      PaginatedSeriesSchema.parse(
        await seriesControllerSearch({ ...params, pageNumber: pageParam }, { signal }),
      ),
    queryKey: seriesKeys.picker(params),
  });
}
