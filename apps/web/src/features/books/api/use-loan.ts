import type { BookView, CreateLoanInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { bookLoanControllerCreateLoan } from "@/shared/api/generated/endpoints/books/books";

import { useBookMutationSync } from "./use-book-mutation-sync";

export function useCreateLoan() {
  const syncBook = useBookMutationSync("loanChanged");

  return useMutation({
    mutationFn: async (input: { id: string; payload: CreateLoanInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookLoanControllerCreateLoan(input.id, input.payload)),
    onSuccess: (book) => {
      syncBook(book);
    },
  });
}
