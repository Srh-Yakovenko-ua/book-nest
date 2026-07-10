import { PaginatedDeliveriesSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { deliveryControllerInTransitList } from "@/shared/api/generated/endpoints/delivery/delivery";

import type { DeliveryListParams } from "../model/in-transit-params";

export type DeliveriesPage = z.infer<typeof PaginatedDeliveriesSchema>;

const MAX_PAGES = 10;

export function useInTransitList(params: DeliveryListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: DeliveriesPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    maxPages: MAX_PAGES,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<DeliveriesPage> => {
      const response = await deliveryControllerInTransitList({ ...params, pageNumber: pageParam });
      return PaginatedDeliveriesSchema.parse(response);
    },
    queryKey: ["/api/delivery/in-transit", "list", params],
  });
}
