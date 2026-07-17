import type { SeriesView } from "@app/shared";

import { PaginatedSeriesSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { seriesControllerSearch } from "@/shared/api/generated/endpoints/series/series";

const SERIES_OPTIONS_PAGE_SIZE = 20;

export function useNoteSeriesOptions(search: string) {
  const trimmed = search.trim();

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<SeriesView[]> => {
      const response = await seriesControllerSearch(
        {
          pageNumber: 1,
          pageSize: SERIES_OPTIONS_PAGE_SIZE,
          ...(trimmed.length > 0 ? { search: trimmed } : {}),
        },
        { signal },
      );
      return PaginatedSeriesSchema.parse(response).items;
    },
    queryKey: ["/api/series", "note-entity-options", trimmed],
  });
}
