import type { BookView, ExtendLoanInput, SetLoanReminderInput, UpdateLoanInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useBookMutationSync } from "@/features/books/api/use-book-mutation-sync";
import {
  bookLoanControllerEditLoan,
  bookLoanControllerExtendLoan,
  bookLoanControllerReturnLoan,
  bookLoanControllerSetLoanReminder,
} from "@/shared/api/generated/endpoints/books/books";

import { matchesLoans } from "./loan-keys";

export function useEditLoan() {
  const queryClient = useQueryClient();
  const syncBook = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: UpdateLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerEditLoan(input.id, input.payload)),
    onSuccess: (book) => {
      syncBook(book);
      void queryClient.invalidateQueries({ predicate: matchesLoans });
    },
  });
}

export function useExtendLoan() {
  const queryClient = useQueryClient();
  const syncBook = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: ExtendLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerExtendLoan(input.id, input.payload)),
    onSuccess: (book) => {
      syncBook(book);
      void queryClient.invalidateQueries({ predicate: matchesLoans });
    },
  });
}

export function useReturnLoan() {
  const queryClient = useQueryClient();
  const syncBook = useBookMutationSync();

  return useMutation({
    mutationFn: async (id: string): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerReturnLoan(id)),
    onSuccess: (book) => {
      syncBook(book);
      void queryClient.invalidateQueries({ predicate: matchesLoans });
    },
  });
}

export function useSetLoanReminder() {
  const queryClient = useQueryClient();
  const syncBook = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: SetLoanReminderInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerSetLoanReminder(input.id, input.payload)),
    onSuccess: (book) => {
      syncBook(book);
      void queryClient.invalidateQueries({ predicate: matchesLoans });
    },
  });
}
