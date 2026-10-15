import type { CreateQuoteInput, QuoteView, UpdateQuoteInput } from "@app/shared";

import { QuoteViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import {
  bookQuotesControllerCreateQuote,
  bookQuotesControllerDeleteQuote,
  bookQuotesControllerUpdateQuote,
} from "@/shared/api/generated/endpoints/quotes/quotes";

import { quoteKeys } from "./quote-keys";

type CreateQuoteVariables = {
  bookId: string;
  input: CreateQuoteInput;
};

type DeleteQuoteVariables = {
  bookId: string;
  quoteId: string;
};

type UpdateQuoteVariables = {
  bookId: string;
  input: UpdateQuoteInput;
  quoteId: string;
};

export function useCreateQuote() {
  const syncQuotes = useQuoteSync();

  return useMutation({
    mutationFn: async ({ bookId, input }: CreateQuoteVariables): Promise<QuoteView> =>
      QuoteViewSchema.parse(await bookQuotesControllerCreateQuote(bookId, input)),
    onSuccess: syncQuotes,
  });
}

export function useDeleteQuote() {
  const syncQuotes = useQuoteSync();

  return useMutation({
    mutationFn: async ({ bookId, quoteId }: DeleteQuoteVariables): Promise<void> => {
      await bookQuotesControllerDeleteQuote(bookId, quoteId);
    },
    onSuccess: syncQuotes,
  });
}

export function useUpdateQuote() {
  const syncQuotes = useQuoteSync();

  return useMutation({
    mutationFn: async ({ bookId, input, quoteId }: UpdateQuoteVariables): Promise<QuoteView> =>
      QuoteViewSchema.parse(await bookQuotesControllerUpdateQuote(bookId, quoteId, input)),
    onSuccess: syncQuotes,
  });
}

function useQuoteSync() {
  const queryClient = useQueryClient();

  return (_result: unknown, { bookId }: { bookId: string }) => {
    void queryClient.invalidateQueries({ queryKey: quoteKeys.root });
    void queryClient.invalidateQueries({ queryKey: bookKeys.chapters(bookId) });
  };
}
