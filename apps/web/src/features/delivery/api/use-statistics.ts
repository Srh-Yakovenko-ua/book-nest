import type { DeliveryStatisticsView } from "@app/shared";

import { DeliveryStatisticsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DeliveryControllerStatisticsParams } from "@/shared/api/generated/model";

import { deliveryControllerStatistics } from "@/shared/api/generated/endpoints/delivery/delivery";

export function useStatistics(params: DeliveryControllerStatisticsParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DeliveryStatisticsView> =>
      DeliveryStatisticsViewSchema.parse(await deliveryControllerStatistics(params)),
    queryKey: ["/api/delivery/statistics", params],
  });
}
