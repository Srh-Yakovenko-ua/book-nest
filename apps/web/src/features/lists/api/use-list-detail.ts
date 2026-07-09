import type { CustomListDetail } from "@app/shared";

import { CustomListDetailSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { listDetailsControllerDetail } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

const LIST_BOOKS_PAGE_SIZE = 24;

export function useListDetail(id: string) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: CustomListDetail) =>
      lastPage.books.page < lastPage.books.pagesCount ? lastPage.books.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<CustomListDetail> => {
      const response = await listDetailsControllerDetail(id, {
        pageNumber: pageParam,
        pageSize: LIST_BOOKS_PAGE_SIZE,
      });
      return CustomListDetailSchema.parse(response);
    },
    queryKey: listKeys.detail(id),
    retry: false,
  });
}
