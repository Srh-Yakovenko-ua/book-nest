import type { CancelledFollowUpView, CancelledFollowUpWishlistResult } from "@app/shared";

import { CancelledFollowUpViewSchema, CancelledFollowUpWishlistResultSchema } from "@app/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

import {
  cancelledFollowUpControllerRead,
  cancelledFollowUpControllerReturnAllToWishlist,
} from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import { useDeliverySync } from "./delivery-cache";
import { deliveryKeys } from "./delivery-keys";

const CANCELLED_FOLLOW_UP_STALE_TIME = milliseconds({ minutes: 1 });

export function useCancelledFollowUp({ enabled }: { enabled: boolean }) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<CancelledFollowUpView> =>
      CancelledFollowUpViewSchema.parse(await cancelledFollowUpControllerRead()),
    queryKey: deliveryKeys.history.cancelledFollowUp,
    staleTime: CANCELLED_FOLLOW_UP_STALE_TIME,
  });
}

export function useReturnAllToWishlist() {
  const sync = useDeliverySync();

  return useMutation({
    mutationFn: async (): Promise<CancelledFollowUpWishlistResult> =>
      CancelledFollowUpWishlistResultSchema.parse(
        await cancelledFollowUpControllerReturnAllToWishlist(),
      ),
    onSuccess: sync,
  });
}
