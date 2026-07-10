import { PaginatedDeliveriesSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { deliveryControllerHistoryList } from "@/shared/api/generated/endpoints/delivery/delivery";

import type { DeliveryHistoryListParams } from "../model/history-params";

export type HistoryPage = z.infer<typeof PaginatedDeliveriesSchema>;

const MAX_PAGES = 10;

export function useHistoryList(params: DeliveryHistoryListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: HistoryPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    maxPages: MAX_PAGES,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<HistoryPage> => {
      const response = await deliveryControllerHistoryList({ ...params, pageNumber: pageParam });
      return PaginatedDeliveriesSchema.parse(response);
    },
    queryKey: ["/api/delivery/history", "list", params],
  });
}
