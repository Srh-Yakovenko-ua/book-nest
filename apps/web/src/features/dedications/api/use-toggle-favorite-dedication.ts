import type { BookDetailsView, BookView } from "@app/shared";

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
      const detailKey = bookKeys.detail(book.id);
      const cachedDetail = queryClient.getQueryData<BookDetailsView>(detailKey);
      if (cachedDetail === undefined) {
        void queryClient.invalidateQueries({ exact: true, queryKey: detailKey });
        return;
      }
      queryClient.setQueryData<BookDetailsView>(detailKey, {
        ...book,
        notesCount: cachedDetail.notesCount,
      });
    },
  });
}
