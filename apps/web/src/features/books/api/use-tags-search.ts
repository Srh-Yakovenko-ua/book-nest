import type { TagView } from "@app/shared";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
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

const TAGS_SEARCH_PAGE_SIZE = 20;

export function useTagsSearch(search: string) {
  const trimmed = search.trim();

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TagView[]> => {
      const response = await tagsControllerSearch({
        pageSize: TAGS_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      const parsed = tagsSearchResultSchema.parse(response);
      return parsed.items;
    },
    queryKey: ["tags", "search", trimmed],
  });
}
