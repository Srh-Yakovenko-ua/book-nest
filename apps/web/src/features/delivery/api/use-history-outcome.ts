import type { BookOrderHistoryOutcomeView } from "@app/shared";

import { BookOrderHistoryOutcomeViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

import { deliveryReadControllerHistoryOutcome } from "@/shared/api/generated/endpoints/delivery-read/delivery-read";

import { deliveryKeys } from "./delivery-keys";

const HISTORY_OUTCOME_STALE_TIME = milliseconds({ minutes: 1 });

export function useHistoryOutcome() {
  return useQuery({
    queryFn: async (): Promise<BookOrderHistoryOutcomeView> =>
      BookOrderHistoryOutcomeViewSchema.parse(await deliveryReadControllerHistoryOutcome()),
    queryKey: deliveryKeys.history.outcome,
    staleTime: HISTORY_OUTCOME_STALE_TIME,
  });
}
