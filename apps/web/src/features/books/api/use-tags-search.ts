import type { TagView } from "@app/shared";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { tagsControllerSearch } from "@/shared/api/generated/endpoints/tags/tags";

const tagViewSchema = z.object({
  id: z.string(),
  name: z.string(),
}) satisfies z.ZodType<TagView>;

const tagsSearchResultSchema = z.object({
  items: z.array(tagViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

type TagsSearchPage = z.infer<typeof tagsSearchResultSchema>;

const TAGS_SEARCH_PAGE_SIZE = 20;

export function useTagsSearch(search: string) {
  const trimmed = search.trim();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: TagsSearchPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<TagsSearchPage> => {
      const response = await tagsControllerSearch({
        pageNumber: pageParam,
        pageSize: TAGS_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      return tagsSearchResultSchema.parse(response);
    },
    queryKey: ["tags", "search", trimmed],
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}
