import { PaginatedBookOrderItemRowsSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { deliveryReadControllerInTransitList } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import type { DeliveryListParams } from "../model/in-transit-params";

export type DeliveriesPage = z.infer<typeof PaginatedBookOrderItemRowsSchema>;

const MAX_PAGES = 10;

export function useInTransitList(params: DeliveryListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: DeliveriesPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    maxPages: MAX_PAGES,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<DeliveriesPage> => {
      const response = await deliveryReadControllerInTransitList({
        ...params,
        pageNumber: pageParam,
      });
      return PaginatedBookOrderItemRowsSchema.parse(response);
    },
    queryKey: ["/api/delivery/books/in-transit", "list", params],
  });
}
