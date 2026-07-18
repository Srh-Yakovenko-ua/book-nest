import type { QuotesSummaryView } from "@app/shared";

import { QuotesSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { quotesControllerSummary } from "@/shared/api/generated/endpoints/quotes/quotes";

import { quoteKeys } from "./quote-keys";

export function useQuotesSummary() {
  return useQuery({
    queryFn: async (): Promise<QuotesSummaryView> =>
      QuotesSummaryViewSchema.parse(await quotesControllerSummary()),
    queryKey: quoteKeys.summary,
  });
}
