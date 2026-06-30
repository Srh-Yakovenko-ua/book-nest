import type { SeriesView } from "@app/shared";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { seriesControllerSearch } from "@/shared/api/generated/endpoints/series/series";

const seriesViewSchema = z.object({
  authors: z.array(z.object({ id: z.string(), name: z.string() })),
  booksInSeries: z.number(),
  description: z.string().nullable(),
  finishedInSeries: z.number(),
  id: z.string(),
  name: z.string(),
  status: z.enum(["completed", "ongoing", "unknown"]),
  totalBooks: z.number().nullable(),
}) satisfies z.ZodType<SeriesView>;

const seriesSearchPageSchema = z.object({
  items: z.array(seriesViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

type SeriesSearchPage = z.infer<typeof seriesSearchPageSchema>;

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
      return seriesSearchPageSchema.parse(response);
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
