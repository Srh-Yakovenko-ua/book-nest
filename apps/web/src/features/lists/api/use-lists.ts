import { LIST_PAGE_SIZE_MAX, PaginatedCustomListsSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";

import { listsControllerSearch } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys, type ListsListParams } from "./list-keys";

export type ListsPage = z.infer<typeof PaginatedCustomListsSchema>;

const LIST_PARAMS = { pageSize: LIST_PAGE_SIZE_MAX } as const satisfies ListsListParams;

export function useLists() {
  const query = useInfiniteQuery({
    getNextPageParam: (lastPage: ListsPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<ListsPage> => {
      const response = await listsControllerSearch({ ...LIST_PARAMS, pageNumber: pageParam });
      return PaginatedCustomListsSchema.parse(response);
    },
    queryKey: listKeys.list(LIST_PARAMS),
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return query;
}
