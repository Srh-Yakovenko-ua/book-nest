import type { BookView, CreateLoanInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { matchesLoans } from "@/features/loans/api/loan-keys";
import { bookLoanControllerCreateLoan } from "@/shared/api/generated/endpoints/books/books";

import { useBookMutationSync } from "./use-book-mutation-sync";

export function useCreateLoan() {
  const queryClient = useQueryClient();
  const syncBook = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: CreateLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerCreateLoan(input.id, input.payload)),
    onSuccess: (book) => {
      syncBook(book);
      void queryClient.invalidateQueries({ predicate: matchesLoans });
    },
  });
}
