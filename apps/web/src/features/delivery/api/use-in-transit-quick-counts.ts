import type { InTransitQuickCounts } from "@app/shared";

import { InTransitQuickCountsSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DeliveryReadControllerInTransitQuickCountsParams } from "@/shared/api/generated/model";

import { deliveryReadControllerInTransitQuickCounts } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import { deliveryKeys } from "./delivery-keys";

export function useInTransitQuickCounts(params: DeliveryReadControllerInTransitQuickCountsParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<InTransitQuickCounts> =>
      InTransitQuickCountsSchema.parse(
        await deliveryReadControllerInTransitQuickCounts(params, { signal }),
      ),
    queryKey: deliveryKeys.inTransit.quickCounts(params),
  });
}
