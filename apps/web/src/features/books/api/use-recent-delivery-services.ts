import type { DeliveryServiceView } from "@app/shared";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { deliveryServicesControllerRecent } from "@/shared/api/generated/endpoints/delivery-services/delivery-services";

import { deliveryServiceViewSchema } from "../model/delivery-service-view-schema";

const RECENT_DELIVERY_SERVICES_LIMIT = 8;

export function useRecentDeliveryServices() {
  return useQuery({
    queryFn: async (): Promise<DeliveryServiceView[]> => {
      const response = await deliveryServicesControllerRecent({
        limit: RECENT_DELIVERY_SERVICES_LIMIT,
      });
      return z.array(deliveryServiceViewSchema).parse(response);
    },
    queryKey: ["delivery-services", "recent"],
  });
}
