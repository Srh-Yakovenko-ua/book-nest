import type { BookOrderHistoryOutcomeView } from "@app/shared";

import { BookOrderHistoryOutcomeViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { deliveryReadControllerHistoryOutcome } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

const HISTORY_OUTCOME_QUERY_KEY = ["/api/delivery/books/history", "outcome"] as const;
const HISTORY_OUTCOME_STALE_TIME = 60_000;

export function useHistoryOutcome() {
  return useQuery({
    queryFn: async (): Promise<BookOrderHistoryOutcomeView> =>
      BookOrderHistoryOutcomeViewSchema.parse(await deliveryReadControllerHistoryOutcome()),
    queryKey: HISTORY_OUTCOME_QUERY_KEY,
    retry: false,
    staleTime: HISTORY_OUTCOME_STALE_TIME,
  });
}
