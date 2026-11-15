import type { BookView, ExtendLoanInput, SetLoanReminderInput, UpdateLoanInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { useBookMutationSync } from "@/features/books/api/use-book-mutation-sync";
import {
  bookLoanControllerEditLoan,
  bookLoanControllerExtendLoan,
  bookLoanControllerReturnLoan,
  bookLoanControllerSetLoanReminder,
} from "@/shared/api/generated/endpoints/books/books";

export function useEditLoan() {
  const syncBook = useBookMutationSync("loanChanged");

  return useMutation({
    mutationFn: async (input: { id: string; payload: UpdateLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerEditLoan(input.id, input.payload)),
    onSuccess: syncBook,
  });
}

export function useExtendLoan() {
  const syncBook = useBookMutationSync("loanChanged");

  return useMutation({
    mutationFn: async (input: { id: string; payload: ExtendLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerExtendLoan(input.id, input.payload)),
    onSuccess: syncBook,
  });
}

export function useReturnLoan() {
  const syncBook = useBookMutationSync("loanChanged");

  return useMutation({
    mutationFn: async (id: string): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerReturnLoan(id)),
    onSuccess: syncBook,
  });
}

export function useSetLoanReminder() {
  const syncBook = useBookMutationSync("loanChanged");

  return useMutation({
    mutationFn: async (input: { id: string; payload: SetLoanReminderInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerSetLoanReminder(input.id, input.payload)),
    onSuccess: syncBook,
  });
}
