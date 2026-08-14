import type { BulkReceiveOrderItemsResultView } from "@app/shared";

import { BulkReceiveOrderItemsResultViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { bookOrderItemsControllerBulkReceive } from "@/shared/api/generated/endpoints/order-items/order-items";

import { useDeliverySync } from "./delivery-cache";

export function useBulkReceive() {
  const sync = useDeliverySync();

  return useMutation({
    mutationFn: async (bookIds: string[]): Promise<BulkReceiveOrderItemsResultView> =>
      BulkReceiveOrderItemsResultViewSchema.parse(
        await bookOrderItemsControllerBulkReceive({ bookIds }),
      ),
    onSuccess: sync,
  });
}
