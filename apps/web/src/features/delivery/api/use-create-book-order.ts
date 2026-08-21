import type { BookOrderView, CreateBookOrderInput } from "@app/shared";

import { BookOrderViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { bookOrdersControllerCreate } from "@/shared/api/generated/endpoints/book-orders/book-orders";

import { useDeliverySync } from "./delivery-cache";

export function useCreateBookOrder() {
  const sync = useDeliverySync();

  return useMutation({
    mutationFn: async (payload: CreateBookOrderInput): Promise<BookOrderView> =>
      BookOrderViewSchema.parse(await bookOrdersControllerCreate(payload)),
    onSuccess: sync,
  });
}
