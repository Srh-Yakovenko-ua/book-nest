import { PaginatedBookOrderItemRowsSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { deliveryReadControllerHistoryList } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import type { DeliveryHistoryListParams } from "../model/history-params";

export type HistoryPage = z.infer<typeof PaginatedBookOrderItemRowsSchema>;

const MAX_PAGES = 10;

export function useHistoryList(params: DeliveryHistoryListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: HistoryPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    maxPages: MAX_PAGES,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<HistoryPage> => {
      const response = await deliveryReadControllerHistoryList({
        ...params,
        pageNumber: pageParam,
      });
      return PaginatedBookOrderItemRowsSchema.parse(response);
    },
    queryKey: ["/api/delivery/books/history", "list", params],
  });
}
