import type { ActiveMoneyAgeResponse } from "@app/shared";

import { ActiveMoneyAgeResponseSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import type { BookOrdersControllerActiveMoneyAgeParams } from "@/shared/api/generated/model";

import { bookOrdersControllerActiveMoneyAge } from "@/shared/api/generated/endpoints/book-orders/book-orders";

import { deliveryKeys } from "./delivery-keys";

export function useActiveMoneyAge(params: BookOrdersControllerActiveMoneyAgeParams) {
  return useQuery({
    queryFn: async (): Promise<ActiveMoneyAgeResponse> =>
      ActiveMoneyAgeResponseSchema.parse(await bookOrdersControllerActiveMoneyAge(params)),
    queryKey: deliveryKeys.statistics.activeMoneyAge(params),
  });
}
