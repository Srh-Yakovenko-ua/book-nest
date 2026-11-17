import type { BookListView } from "@app/shared";

import { PaginatedCustomListsSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { listKeys } from "@/features/lists/api/list-keys";
import { listsControllerSearch } from "@/shared/api/generated/endpoints/lists/lists";

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
      return PaginatedCustomListsSchema.parse(response).items;
    },
    queryKey: listKeys.search(trimmed),
  });
}
