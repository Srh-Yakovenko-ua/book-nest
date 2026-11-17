import type { DeliveryServiceView } from "@app/shared";

import { PaginatedDeliveryServicesSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { deliveryServicesControllerSearch } from "@/shared/api/generated/endpoints/delivery-services/delivery-services";

import { deliveryServiceKeys } from "./delivery-service-keys";

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
      const parsed = PaginatedDeliveryServicesSchema.parse(response);
      return parsed.items;
    },
    queryKey: deliveryServiceKeys.search(trimmed),
  });
}
