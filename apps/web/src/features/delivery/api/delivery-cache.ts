import type { QueryKey } from "@tanstack/react-query";

import { partialMatchKey, useQueryClient } from "@tanstack/react-query";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";

import { deliveryKeys } from "./delivery-keys";

export function useDeliverySync() {
  const queryClient = useQueryClient();
  return () => {
    void bookChangeEffects.booksChanged(queryClient, { changes: ["statusChanged"] });
  };
}

export function useDeliverySyncAwaitingInTransitList() {
  const queryClient = useQueryClient();
  return () => {
    void bookChangeEffects.booksChanged(queryClient, {
      changes: ["statusChanged"],
      keep: [matchesInTransitLists],
    });
    return queryClient.invalidateQueries({ queryKey: deliveryKeys.inTransit.lists });
  };
}

function matchesInTransitLists({ queryKey }: { queryKey: QueryKey }): boolean {
  return partialMatchKey(queryKey, deliveryKeys.inTransit.lists);
}
