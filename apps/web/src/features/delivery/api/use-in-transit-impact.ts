import type { InTransitImpactView } from "@app/shared";

import { InTransitImpactViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

import { deliveryReadControllerInTransitImpact } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import { deliveryKeys } from "./delivery-keys";

const IN_TRANSIT_IMPACT_STALE_TIME = milliseconds({ minutes: 1 });

export function useInTransitImpact() {
  return useQuery({
    queryFn: async (): Promise<InTransitImpactView> =>
      InTransitImpactViewSchema.parse(await deliveryReadControllerInTransitImpact()),
    queryKey: deliveryKeys.inTransit.impact,
    staleTime: IN_TRANSIT_IMPACT_STALE_TIME,
  });
}
