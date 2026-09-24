import { TAG_COLORS, type TagColor, type TagView } from "@app/shared";
import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";

import { tagsKeys } from "@/features/tags/api/tags-keys";
import { tagsControllerSearch } from "@/shared/api/generated/endpoints/tags/tags";

const tagViewSchema = z.object({
  color: z.enum(TAG_COLORS),
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

export function useSearchedTagColors(): ReadonlyMap<string, TagColor> {
  const queryClient = useQueryClient();
  const searches = queryClient.getQueriesData<InfiniteData<TagsSearchPage>>({
    queryKey: tagsKeys.pickers,
  });

  return new Map(
    searches.flatMap(([, data]) =>
      (data?.pages ?? []).flatMap((page) =>
        page.items.map((tag) => [tag.name.toLowerCase(), tag.color] as const),
      ),
    ),
  );
}

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
    queryKey: tagsKeys.picker(trimmed),
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}
