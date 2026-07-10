import type { DeliveryHistorySummaryView } from "@app/shared";

import { DeliveryHistorySummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { deliveryControllerHistorySummary } from "@/shared/api/generated/endpoints/delivery/delivery";

export function useHistorySummary() {
  return useQuery({
    queryFn: async (): Promise<DeliveryHistorySummaryView> =>
      DeliveryHistorySummaryViewSchema.parse(await deliveryControllerHistorySummary()),
    queryKey: ["/api/delivery/history", "summary"],
  });
}
