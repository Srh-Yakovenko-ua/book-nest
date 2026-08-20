import type { CancelledFollowUpView, CancelledFollowUpWishlistResult } from "@app/shared";

import { CancelledFollowUpViewSchema, CancelledFollowUpWishlistResultSchema } from "@app/shared";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  cancelledFollowUpControllerRead,
  cancelledFollowUpControllerReturnAllToWishlist,
} from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import { useDeliverySync } from "./delivery-cache";

const CANCELLED_FOLLOW_UP_QUERY_KEY = [
  "/api/delivery/books/history",
  "cancelled-follow-up",
] as const;
const CANCELLED_FOLLOW_UP_STALE_TIME = 60_000;

export function useCancelledFollowUp({ enabled }: { enabled: boolean }) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<CancelledFollowUpView> =>
      CancelledFollowUpViewSchema.parse(await cancelledFollowUpControllerRead()),
    queryKey: CANCELLED_FOLLOW_UP_QUERY_KEY,
    retry: false,
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
