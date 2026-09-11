import type { QuotePostFinishReviewInput, QuoteRediscoveryImpressionInput } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  quotesControllerRecordRediscoveryImpression,
  quotesControllerReviewPostFinish,
} from "@/shared/api/generated/endpoints/quotes/quotes";

import { quoteKeys } from "./quote-keys";

export function useRecordRediscoveryImpression() {
  return useMutation({
    mutationFn: async ({ quoteId }: QuoteRediscoveryImpressionInput): Promise<void> => {
      await quotesControllerRecordRediscoveryImpression({ quoteId });
    },
  });
}

export function useReviewPostFinish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ readingCycleId }: QuotePostFinishReviewInput): Promise<void> => {
      await quotesControllerReviewPostFinish({ readingCycleId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quoteKeys.overview });
    },
  });
}
