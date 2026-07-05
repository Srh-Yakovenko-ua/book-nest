import type { BookView, CreateLoanInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import {
  bookLoanControllerCreateLoan,
  bookLoanControllerReturnLoan,
} from "@/shared/api/generated/endpoints/books/books";

import { useBookMutationSync } from "./use-book-mutation-sync";

export function useCreateLoan() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: CreateLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerCreateLoan(input.id, input.payload)),
    onSuccess: sync,
  });
}

export function useReturnLoan() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (id: string): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerReturnLoan(id)),
    onSuccess: sync,
  });
}
