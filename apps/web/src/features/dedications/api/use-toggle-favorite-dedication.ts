import type { BookView } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys, matchesBooksExceptDetail } from "@/features/books/api/book-keys";
import { booksControllerUpdate } from "@/shared/api/generated/endpoints/books/books";

type ToggleFavoriteDedicationInput = {
  id: string;
  isFavoriteDedication: boolean;
};

export function useToggleFavoriteDedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      isFavoriteDedication,
    }: ToggleFavoriteDedicationInput): Promise<BookView> =>
      BookViewSchema.parse(await booksControllerUpdate(id, { isFavoriteDedication })),
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ predicate: matchesBooksExceptDetail(id) });
    },
    onSuccess: (book) => {
      queryClient.setQueryData<BookView>(bookKeys.detail(book.id), book);
    },
  });
}
