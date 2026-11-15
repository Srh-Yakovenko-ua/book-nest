import { PaginatedOrderHistoryGroupsSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { deliveryReadControllerHistoryList } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import type { DeliveryHistoryListParams } from "../model/history-params";

import { deliveryKeys } from "./delivery-keys";

export type HistoryPage = z.infer<typeof PaginatedOrderHistoryGroupsSchema>;

export function useHistoryList(params: DeliveryHistoryListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: HistoryPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<HistoryPage> => {
      const response = await deliveryReadControllerHistoryList({
        ...params,
        pageNumber: pageParam,
      });
      return PaginatedOrderHistoryGroupsSchema.parse(response);
    },
    queryKey: deliveryKeys.history.list(params),
  });
}
