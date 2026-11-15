import type { BookListsView, NewListInput } from "@app/shared";

import { BookListsViewSchema } from "@app/shared";
import { partialMatchKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bookListsControllerGetLists,
  bookListsControllerSetLists,
} from "@/shared/api/generated/endpoints/books/books";

import { bookChangeEffects } from "./book-change-effects";
import { bookKeys } from "./book-keys";

export function useBookLists(bookId: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<BookListsView> =>
      BookListsViewSchema.parse(await bookListsControllerGetLists(bookId)),
    queryKey: bookListsKey(bookId),
  });
}

export function useSetBookLists(bookId: string) {
  const queryClient = useQueryClient();
  const listsKey = bookListsKey(bookId);

  return useMutation({
    mutationFn: async (input: {
      listIds: string[];
      newLists: NewListInput[];
    }): Promise<BookListsView> =>
      BookListsViewSchema.parse(await bookListsControllerSetLists(bookId, input)),
    onSuccess: (result) => {
      queryClient.setQueryData(listsKey, result);
      void bookChangeEffects.booksChanged(queryClient, {
        changes: ["listed"],
        keep: [({ queryKey }) => partialMatchKey(queryKey, listsKey)],
      });
    },
  });
}

function bookListsKey(bookId: string) {
  return [...bookKeys.detail(bookId), "lists"] as const;
}
