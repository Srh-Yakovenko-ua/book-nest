import { BookOrderHistoryFacetsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { deliveryReadControllerHistoryFacets } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import type { DeliveryHistoryTab } from "../model/history-params";

export function useHistoryFacets({ enabled, tab }: { enabled: boolean; tab: DeliveryHistoryTab }) {
  return useQuery({
    enabled,
    queryFn: async () =>
      BookOrderHistoryFacetsViewSchema.parse(await deliveryReadControllerHistoryFacets({ tab })),
    queryKey: ["/api/delivery/books/history/facets", tab],
  });
}
