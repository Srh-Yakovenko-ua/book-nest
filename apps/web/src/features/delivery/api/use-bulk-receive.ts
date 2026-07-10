import type { BulkReceiveDeliveriesResultView } from "@app/shared";

import { BulkReceiveDeliveriesResultViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { deliveryControllerBulkReceive } from "@/shared/api/generated/endpoints/delivery/delivery";

import { useDeliverySync } from "./delivery-cache";

export function useBulkReceive() {
  const sync = useDeliverySync();

  return useMutation({
    mutationFn: async (bookIds: string[]): Promise<BulkReceiveDeliveriesResultView> =>
      BulkReceiveDeliveriesResultViewSchema.parse(await deliveryControllerBulkReceive({ bookIds })),
    onSuccess: sync,
  });
}
