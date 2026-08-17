import type { BookOrderView } from "@app/shared";

import { BookOrderViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import {
  bookOrdersControllerFindById,
  getBookOrdersControllerFindByIdQueryKey,
} from "@/shared/api/generated/endpoints/book-orders/book-orders";

export function useBookOrder(orderId: string) {
  return useQuery({
    queryFn: async (): Promise<BookOrderView> =>
      BookOrderViewSchema.parseAsync(await bookOrdersControllerFindById(orderId)),
    queryKey: getBookOrdersControllerFindByIdQueryKey(orderId),
    retry: false,
  });
}
