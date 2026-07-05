import { LIST_PAGE_SIZE_MAX, PaginatedSeriesSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";

import { seriesControllerSearch } from "@/shared/api/generated/endpoints/series/series";

import { seriesKeys, type SeriesListParams } from "./series-keys";

export type SeriesPage = z.infer<typeof PaginatedSeriesSchema>;

const LIST_PARAMS = { pageSize: LIST_PAGE_SIZE_MAX } as const satisfies SeriesListParams;

export function useSeriesList() {
  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: SeriesPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<SeriesPage> => {
      const response = await seriesControllerSearch({ ...LIST_PARAMS, pageNumber: pageParam });
      return PaginatedSeriesSchema.parse(response);
    },
    queryKey: seriesKeys.list(LIST_PARAMS),
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return query;
}
