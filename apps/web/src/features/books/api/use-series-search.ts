import { PaginatedSeriesSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { seriesControllerSearch } from "@/shared/api/generated/endpoints/series/series";

type SeriesSearchPage = z.infer<typeof PaginatedSeriesSchema>;

const SERIES_SEARCH_PAGE_SIZE = 20;

type UseSeriesSearchOptions = {
  authorIds?: string[];
  search: string;
};

export function useSeriesSearch({ authorIds, search }: UseSeriesSearchOptions) {
  const trimmed = search.trim();
  const scopedAuthorIds = authorIds && authorIds.length > 0 ? [...authorIds].sort() : undefined;

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: SeriesSearchPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<SeriesSearchPage> => {
      const response = await seriesControllerSearch({
        ...(scopedAuthorIds ? { authorIds: scopedAuthorIds } : {}),
        pageNumber: pageParam,
        pageSize: SERIES_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      return PaginatedSeriesSchema.parse(response);
    },
    queryKey: ["series", "search", trimmed, scopedAuthorIds ?? []],
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = query.data?.pages.at(-1)?.totalCount ?? 0;

  return {
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    items,
    totalCount,
  };
}
