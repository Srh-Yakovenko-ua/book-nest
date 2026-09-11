import type { QuotesOverviewView } from "@app/shared";

import { QuotesOverviewViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { quotesControllerOverview } from "@/shared/api/generated/endpoints/quotes/quotes";

import { quoteKeys } from "./quote-keys";

export function useQuotesOverview() {
  return useQuery({
    queryFn: async (): Promise<QuotesOverviewView> =>
      QuotesOverviewViewSchema.parse(await quotesControllerOverview()),
    queryKey: quoteKeys.overview,
  });
}
