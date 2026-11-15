import type { BookDetailsView, BookView } from "@app/shared";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys, matchesBooksExceptDetail } from "@/features/books/api/book-keys";
import { booksControllerUpdate } from "@/shared/api/generated/endpoints/books/books";

import type { DedicationsPage } from "./use-dedications";

import { dedicationKeys } from "./dedication-keys";

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
      writeDedicationListRow(queryClient, book);
      const detailKey = bookKeys.detail(book.id);
      const cachedDetail = queryClient.getQueryData<BookDetailsView>(detailKey);
      if (cachedDetail === undefined) {
        void queryClient.invalidateQueries({ exact: true, queryKey: detailKey });
        return;
      }
      queryClient.setQueryData<BookDetailsView>(detailKey, {
        ...book,
        notesCount: cachedDetail.notesCount,
        quotesCount: cachedDetail.quotesCount,
      });
    },
  });
}

function writeDedicationListRow(queryClient: QueryClient, book: BookView): void {
  const replace = (item: BookView) => (item.id === book.id ? book : item);

  queryClient.setQueriesData<InfiniteData<DedicationsPage>>(
    { queryKey: dedicationKeys.lists },
    (data) =>
      data === undefined
        ? data
        : {
            ...data,
            pages: data.pages.map((page) => ({ ...page, items: page.items.map(replace) })),
          },
  );
}
