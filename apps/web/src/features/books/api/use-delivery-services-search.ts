import type { DeliveryServiceView } from "@app/shared";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { deliveryServicesControllerSearch } from "@/shared/api/generated/endpoints/delivery-services/delivery-services";

import { deliveryServiceViewSchema } from "../model/delivery-service-view-schema";

const deliveryServiceSearchResultSchema = z.object({
  items: z.array(deliveryServiceViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

const DELIVERY_SERVICE_SEARCH_PAGE_SIZE = 20;

export function useDeliveryServicesSearch(search: string) {
  const trimmed = search.trim();

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DeliveryServiceView[]> => {
      const response = await deliveryServicesControllerSearch({
        pageSize: DELIVERY_SERVICE_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      const parsed = deliveryServiceSearchResultSchema.parse(response);
      return parsed.items;
    },
    queryKey: ["delivery-services", "search", trimmed],
  });
}
