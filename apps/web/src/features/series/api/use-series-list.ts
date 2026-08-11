import { LIST_PAGE_SIZE_MAX, PaginatedSeriesSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";

import type { SeriesControllerSearchParams } from "@/shared/api/generated/model";

import { seriesControllerSearch } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys, type SeriesListParams } from "./series-keys";

export type SeriesPage = z.infer<typeof PaginatedSeriesSchema>;

export function useSeriesList(params: SeriesControllerSearchParams = {}) {
  const listParams: SeriesListParams = { ...params, pageSize: LIST_PAGE_SIZE_MAX };

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: SeriesPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<SeriesPage> => {
      const response = await seriesControllerSearch({ ...listParams, pageNumber: pageParam });
      return PaginatedSeriesSchema.parse(response);
    },
    queryKey: seriesKeys.list(listParams),
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return query;
}
