import type { Paginator, QuoteView } from "@app/shared";

import { PaginatedQuotesSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { quotesControllerList } from "@/shared/api/generated/endpoints/quotes/quotes";

import type { QuotesListParams } from "../model/quotes-query";

import { quoteKeys } from "./quote-keys";

type BookQuotesPage = Paginator<QuoteView>;

export function useBookQuotesList(params: QuotesListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: BookQuotesPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<BookQuotesPage> =>
      PaginatedQuotesSchema.parse(
        await quotesControllerList({ ...params, pageNumber: pageParam }, { signal }),
      ),
    queryKey: quoteKeys.list(params),
    retry: false,
  });
}
