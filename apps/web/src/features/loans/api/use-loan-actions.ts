import type { BookView, ExtendLoanInput, SetLoanReminderInput, UpdateLoanInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";
import {
  bookLoanControllerEditLoan,
  bookLoanControllerExtendLoan,
  bookLoanControllerReturnLoan,
  bookLoanControllerSetLoanReminder,
} from "@/shared/api/generated/endpoints/books/books";

export function useEditLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; payload: UpdateLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerEditLoan(input.id, input.payload)),
    onSuccess: (book) => {
      void bookChangeEffects.bookSaved(queryClient, { book, change: "loanChanged" });
    },
  });
}

export function useExtendLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; payload: ExtendLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerExtendLoan(input.id, input.payload)),
    onSuccess: (book) => {
      void bookChangeEffects.bookSaved(queryClient, { book, change: "loanChanged" });
    },
  });
}

export function useReturnLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerReturnLoan(id)),
    onSuccess: (book) => {
      void bookChangeEffects.bookSaved(queryClient, { book, change: "loanChanged" });
    },
  });
}

export function useSetLoanReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; payload: SetLoanReminderInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerSetLoanReminder(input.id, input.payload)),
    onSuccess: (book) => {
      void bookChangeEffects.bookSaved(queryClient, { book, change: "loanChanged" });
    },
  });
}
