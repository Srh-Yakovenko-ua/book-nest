import type { DeliveryServiceView } from "@app/shared";

import { DeliveryServiceViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { deliveryServicesControllerRecent } from "@/shared/api/generated/endpoints/delivery-services/delivery-services";

import { deliveryServiceKeys } from "./delivery-service-keys";

const RECENT_DELIVERY_SERVICES_LIMIT = 8;

export function useRecentDeliveryServices() {
  return useQuery({
    queryFn: async (): Promise<DeliveryServiceView[]> => {
      const response = await deliveryServicesControllerRecent({
        limit: RECENT_DELIVERY_SERVICES_LIMIT,
      });
      return z.array(DeliveryServiceViewSchema).parse(response);
    },
    queryKey: deliveryServiceKeys.recent,
  });
}
