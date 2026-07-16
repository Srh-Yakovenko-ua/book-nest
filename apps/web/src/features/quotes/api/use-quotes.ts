import type { QuotesQuery } from "@app/shared";

import { PaginatedQuotesSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { quotesControllerList } from "@/shared/api/generated/endpoints/quotes/quotes";

import { quoteKeys } from "./quote-keys";

export type QuotesPage = z.infer<typeof PaginatedQuotesSchema>;

export function useQuotes(params: QuotesQuery) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<QuotesPage> =>
      PaginatedQuotesSchema.parse(await quotesControllerList(params)),
    queryKey: quoteKeys.list(params),
  });
}
