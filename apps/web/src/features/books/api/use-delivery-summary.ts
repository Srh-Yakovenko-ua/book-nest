import type { DeliveryInTransitSummaryView } from "@app/shared";

import { DeliveryInTransitSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { deliveryControllerInTransitSummary } from "@/shared/api/generated/endpoints/delivery/delivery";

const DELIVERY_SUMMARY_QUERY_KEY = ["/api/delivery/in-transit", "summary"] as const;
const DELIVERY_SUMMARY_STALE_TIME = 60_000;

export function useDeliveryInTransitSummary() {
  return useQuery({
    queryFn: async (): Promise<DeliveryInTransitSummaryView> =>
      DeliveryInTransitSummaryViewSchema.parse(await deliveryControllerInTransitSummary()),
    queryKey: DELIVERY_SUMMARY_QUERY_KEY,
    retry: false,
    staleTime: DELIVERY_SUMMARY_STALE_TIME,
  });
}
