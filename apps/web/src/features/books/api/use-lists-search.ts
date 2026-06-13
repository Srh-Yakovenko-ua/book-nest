import type { BookListView } from "@app/shared";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { listsControllerSearch } from "@/shared/api/generated/endpoints/lists/lists";

const listViewSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
}) satisfies z.ZodType<BookListView>;

const listsSearchResultSchema = z.object({
  items: z.array(listViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

const LISTS_SEARCH_PAGE_SIZE = 50;

export function useListsSearch(search: string) {
  const trimmed = search.trim();

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BookListView[]> => {
      const response = await listsControllerSearch({
        pageSize: LISTS_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      const parsed = listsSearchResultSchema.parse(response);
      return parsed.items;
    },
    queryKey: ["lists", "search", trimmed],
  });
}
