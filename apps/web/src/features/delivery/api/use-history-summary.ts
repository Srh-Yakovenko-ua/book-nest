import type { BookOrderHistorySummaryView } from "@app/shared";

import { BookOrderHistorySummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { deliveryReadControllerHistorySummary } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import { deliveryKeys } from "./delivery-keys";

export function useHistorySummary() {
  return useQuery({
    queryFn: async (): Promise<BookOrderHistorySummaryView> =>
      BookOrderHistorySummaryViewSchema.parse(await deliveryReadControllerHistorySummary()),
    queryKey: deliveryKeys.history.summary,
  });
}
