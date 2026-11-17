import type { BookOrderView } from "@app/shared";

import { BookOrderViewSchema } from "@app/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { bookOrdersControllerFindById } from "@/shared/api/generated/endpoints/book-orders/book-orders";

import { deliveryKeys } from "./delivery-keys";

export function bookOrderQueryOptions(orderId: string) {
  return queryOptions({
    queryFn: async (): Promise<BookOrderView> =>
      BookOrderViewSchema.parseAsync(await bookOrdersControllerFindById(orderId)),
    queryKey: deliveryKeys.orders.detail(orderId),
  });
}

export function useBookOrder(orderId: string) {
  return useQuery(bookOrderQueryOptions(orderId));
}
