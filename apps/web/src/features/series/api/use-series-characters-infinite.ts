import type { CharacterSummaryView, Paginator } from "@app/shared";

import { PaginatedCharacterSummarySchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { SeriesCharactersControllerListParams } from "@/shared/api/generated/model";

import { seriesCharactersControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { seriesKeys } from "./series-keys";

type SeriesCharactersPage = Paginator<CharacterSummaryView>;

export function useSeriesCharactersInfinite({
  params,
  seriesId,
}: {
  params: SeriesCharactersControllerListParams;
  seriesId: string;
}) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: SeriesCharactersPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<SeriesCharactersPage> =>
      PaginatedCharacterSummarySchema.parse(
        await seriesCharactersControllerList(
          seriesId,
          { ...params, pageNumber: pageParam },
          { signal },
        ),
      ),
    queryKey: seriesKeys.characters(seriesId, params),
  });
}
