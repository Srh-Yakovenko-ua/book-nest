import { PaginatedCustomListsSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { listsControllerSearch } from "@/shared/api/generated/endpoints/lists/lists";

import type { ListsListParams } from "../model/lists-query";

import { listKeys } from "./list-keys";

export type ListsPage = z.infer<typeof PaginatedCustomListsSchema>;

export function useLists(params: ListsListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: ListsPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<ListsPage> => {
      const response = await listsControllerSearch({ ...params, pageNumber: pageParam });
      return PaginatedCustomListsSchema.parse(response);
    },
    queryKey: listKeys.list(params),
  });
}
