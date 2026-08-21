import type { InTransitImpactView } from "@app/shared";

import { InTransitImpactViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { deliveryReadControllerInTransitImpact } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

const IN_TRANSIT_IMPACT_QUERY_KEY = ["/api/delivery/books/in-transit", "impact"] as const;
const IN_TRANSIT_IMPACT_STALE_TIME = 60_000;

export function useInTransitImpact() {
  return useQuery({
    queryFn: async (): Promise<InTransitImpactView> =>
      InTransitImpactViewSchema.parse(await deliveryReadControllerInTransitImpact()),
    queryKey: IN_TRANSIT_IMPACT_QUERY_KEY,
    retry: false,
    staleTime: IN_TRANSIT_IMPACT_STALE_TIME,
  });
}
