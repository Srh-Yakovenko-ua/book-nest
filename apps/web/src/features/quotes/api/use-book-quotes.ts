import type { BookQuotesView } from "@app/shared";

import { BookQuotesViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { bookQuotesControllerListBookQuotes } from "@/shared/api/generated/endpoints/quotes/quotes";

import { quoteKeys } from "./quote-keys";

export function useBookQuotes(bookId: string) {
  return useQuery({
    queryFn: async (): Promise<BookQuotesView> =>
      BookQuotesViewSchema.parse(await bookQuotesControllerListBookQuotes(bookId)),
    queryKey: quoteKeys.forBook(bookId),
  });
}
