import type { InTransitSummaryView } from "@app/shared";

import { InTransitSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

import { deliveryKeys } from "@/features/delivery/api/delivery-keys";
import { deliveryReadControllerInTransitSummary } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

const DELIVERY_SUMMARY_STALE_TIME = milliseconds({ minutes: 1 });

export function useDeliveryInTransitSummary() {
  return useQuery({
    queryFn: async (): Promise<InTransitSummaryView> =>
      InTransitSummaryViewSchema.parse(await deliveryReadControllerInTransitSummary()),
    queryKey: deliveryKeys.inTransit.summary,
    staleTime: DELIVERY_SUMMARY_STALE_TIME,
  });
}
