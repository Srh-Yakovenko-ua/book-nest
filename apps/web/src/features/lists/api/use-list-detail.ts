import type { CustomListDetail, ListBookSort } from "@app/shared";

import { CustomListDetailSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { listDetailsControllerDetail } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

const LIST_BOOKS_PAGE_SIZE = 24;

type UseListDetailParams = {
  search: string;
  sort: ListBookSort;
};

export function useListDetail(id: string, { search, sort }: UseListDetailParams) {
  const trimmedSearch = search.trim();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: CustomListDetail) =>
      lastPage.books.page < lastPage.books.pagesCount ? lastPage.books.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<CustomListDetail> => {
      const response = await listDetailsControllerDetail(id, {
        pageNumber: pageParam,
        pageSize: LIST_BOOKS_PAGE_SIZE,
        sort,
        ...(trimmedSearch === "" ? {} : { search: trimmedSearch }),
      });
      return CustomListDetailSchema.parse(response);
    },
    queryKey: [...listKeys.detail(id), { search: trimmedSearch, sort }],
    retry: false,
  });
}
