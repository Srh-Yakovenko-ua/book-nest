import type { CustomListDetail } from "@app/shared";

import { CustomListDetailSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { listDetailsControllerDetail } from "@/shared/api/generated/endpoints/lists/lists";

import type { ListDetailBooksParams } from "../model/list-detail-query";

import { listKeys } from "./list-keys";

export function useListDetail(id: string, params: ListDetailBooksParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: CustomListDetail) =>
      lastPage.books.page < lastPage.books.pagesCount ? lastPage.books.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<CustomListDetail> => {
      const response = await listDetailsControllerDetail(id, { ...params, pageNumber: pageParam });
      return CustomListDetailSchema.parse(response);
    },
    queryKey: [...listKeys.detail(id), params],
    retry: false,
  });
}
