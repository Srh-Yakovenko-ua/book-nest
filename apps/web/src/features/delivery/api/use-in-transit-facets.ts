import { InTransitFacetsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { deliveryReadControllerInTransitFacets } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

export function useInTransitFacets(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async () =>
      InTransitFacetsViewSchema.parse(await deliveryReadControllerInTransitFacets()),
    queryKey: ["/api/delivery/books/in-transit/facets"],
  });
}
