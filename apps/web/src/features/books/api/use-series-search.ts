import type { SeriesView } from "@app/shared";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { seriesControllerSearch } from "@/shared/api/generated/endpoints/series/series";

const seriesViewSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  status: z.enum(["completed", "ongoing", "unknown"]),
  totalBooks: z.number().nullable(),
}) satisfies z.ZodType<SeriesView>;

const seriesSearchResultSchema = z.object({
  items: z.array(seriesViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

const SERIES_SEARCH_MIN_LENGTH = 2;
const SERIES_SEARCH_PAGE_SIZE = 8;

export function useSeriesSearch(search: string) {
  const trimmed = search.trim();
  const enabled = trimmed.length >= SERIES_SEARCH_MIN_LENGTH;

  return useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SeriesView[]> => {
      const response = await seriesControllerSearch({
        pageSize: SERIES_SEARCH_PAGE_SIZE,
        search: trimmed,
      });
      const parsed = seriesSearchResultSchema.parse(response);
      return parsed.items;
    },
    queryKey: ["series", "search", trimmed],
  });
}
