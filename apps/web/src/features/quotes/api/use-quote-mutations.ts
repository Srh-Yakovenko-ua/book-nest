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
  const sync = useQuoteSync();

  return useMutation({
    mutationFn: async ({ bookId, input }: CreateQuoteVariables): Promise<QuoteView> =>
      QuoteViewSchema.parse(await bookQuotesControllerCreateQuote(bookId, input)),
    onSuccess: sync.afterCountChange,
  });
}

export function useDeleteQuote() {
  const sync = useQuoteSync();

  return useMutation({
    mutationFn: async ({ bookId, quoteId }: DeleteQuoteVariables): Promise<void> => {
      await bookQuotesControllerDeleteQuote(bookId, quoteId);
    },
    onSuccess: sync.afterCountChange,
  });
}

export function useUpdateQuote() {
  const sync = useQuoteSync();

  return useMutation({
    mutationFn: async ({ bookId, input, quoteId }: UpdateQuoteVariables): Promise<QuoteView> =>
      QuoteViewSchema.parse(await bookQuotesControllerUpdateQuote(bookId, quoteId, input)),
    onSuccess: sync.afterEdit,
  });
}

function useQuoteSync() {
  const queryClient = useQueryClient();

  function refreshQuotes(bookId: string) {
    void queryClient.invalidateQueries({ queryKey: quoteKeys.root });
    void queryClient.invalidateQueries({ queryKey: bookKeys.chapters(bookId) });
  }

  return {
    afterCountChange: (_result: unknown, { bookId }: { bookId: string }) => {
      refreshQuotes(bookId);
      void queryClient.invalidateQueries({ exact: true, queryKey: bookKeys.detail(bookId) });
    },
    afterEdit: (_result: unknown, { bookId }: { bookId: string }) => refreshQuotes(bookId),
  };
}
