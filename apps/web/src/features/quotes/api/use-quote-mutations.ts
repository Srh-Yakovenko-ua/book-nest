import type { CreateQuoteInput, QuoteView, UpdateQuoteInput } from "@app/shared";

import { QuoteViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  bookQuotesControllerCreateQuote,
  bookQuotesControllerDeleteQuote,
  bookQuotesControllerUpdateQuote,
} from "@/shared/api/generated/endpoints/quotes/quotes";

import { quoteChangeEffects } from "./quote-change-effects";

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookId, input }: CreateQuoteVariables): Promise<QuoteView> =>
      QuoteViewSchema.parse(await bookQuotesControllerCreateQuote(bookId, input)),
    onSuccess: (_quote, { bookId }) => {
      void quoteChangeEffects.quotesChanged(queryClient, { bookId, change: "created" });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookId, quoteId }: DeleteQuoteVariables): Promise<void> => {
      await bookQuotesControllerDeleteQuote(bookId, quoteId);
    },
    onSuccess: (_result, { bookId }) => {
      void quoteChangeEffects.quotesChanged(queryClient, { bookId, change: "deleted" });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookId, input, quoteId }: UpdateQuoteVariables): Promise<QuoteView> =>
      QuoteViewSchema.parse(await bookQuotesControllerUpdateQuote(bookId, quoteId, input)),
    onSuccess: (_quote, { bookId }) => {
      void quoteChangeEffects.quotesChanged(queryClient, { bookId, change: "updated" });
    },
  });
}
