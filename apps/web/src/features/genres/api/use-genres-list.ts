import type { GenreStatsView, Paginator } from "@app/shared";

import { GENRES_PAGE_SIZE, PaginatedGenreStatsSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { genresControllerStats } from "@/shared/api/generated/endpoints/genres/genres";

import type { GenresListParams } from "../model/genres-query";

import { genresKeys } from "./genres-keys";

type GenresPage = Paginator<GenreStatsView>;

export function useGenresList(params: GenresListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: GenresPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<GenresPage> =>
      PaginatedGenreStatsSchema.parse(
        await genresControllerStats(
          { ...params, pageNumber: pageParam, pageSize: GENRES_PAGE_SIZE },
          { signal },
        ),
      ),
    queryKey: genresKeys.stats(params),
    retry: false,
  });
}
