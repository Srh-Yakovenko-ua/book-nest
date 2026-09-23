import type { PaginatedTagCatalog } from "@app/shared";

import { PaginatedTagCatalogSchema, TAGS_PAGE_SIZE } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { tagsControllerCatalog } from "@/shared/api/generated/endpoints/tags/tags";

import type { TagsCatalogParams } from "../model/tags-query";

import { tagsKeys } from "./tags-keys";

export function useTagsCatalog(params: TagsCatalogParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: PaginatedTagCatalog) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<PaginatedTagCatalog> =>
      PaginatedTagCatalogSchema.parse(
        await tagsControllerCatalog(
          { ...params, pageNumber: pageParam, pageSize: TAGS_PAGE_SIZE },
          { signal },
        ),
      ),
    queryKey: tagsKeys.catalog(params),
    retry: false,
  });
}
