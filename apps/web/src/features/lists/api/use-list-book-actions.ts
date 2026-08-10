import type { BookView, CustomListDetail, ReadingStatus } from "@app/shared";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { goalKeys } from "@/features/reading-goals";
import {
  bookReadingControllerChangeReadingStatus,
  booksControllerUpdate,
} from "@/shared/api/generated/endpoints/books/books";

import { listKeys } from "./list-keys";
import { useListCacheInvalidation } from "./use-list-cache";

type FavoriteContext = {
  snapshot: [QueryKey, InfiniteData<CustomListDetail> | undefined][];
};

export function useSetListBookReadingStatus(listId: string) {
  const cache = useListCacheInvalidation(listId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      readingStatus: ReadingStatus;
    }): Promise<BookView> =>
      BookViewSchema.parse(
        await bookReadingControllerChangeReadingStatus(input.bookId, {
          status: input.readingStatus,
        }),
      ),
    onSuccess: () => {
      cache.readingStatusChanged();
      void queryClient.invalidateQueries({ queryKey: goalKeys.forList(listId) });
    },
  });
}

export function useToggleListBookFavorite(listId: string) {
  const cache = useListCacheInvalidation(listId);
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { bookId: string; isFavorite: boolean }, FavoriteContext>({
    mutationFn: ({ bookId, isFavorite }) => booksControllerUpdate(bookId, { isFavorite }),
    onError: (_error, _input, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onMutate: async ({ bookId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });
      const snapshot = queryClient.getQueriesData<InfiniteData<CustomListDetail>>({
        queryKey: listKeys.detail(listId),
      });
      for (const [key, data] of snapshot) {
        if (data === undefined) continue;
        queryClient.setQueryData<InfiniteData<CustomListDetail>>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            books: {
              ...page.books,
              items: page.books.items.map((book) =>
                book.id === bookId ? { ...book, isFavorite } : book,
              ),
            },
          })),
        });
      }
      return { snapshot };
    },
    onSettled: cache.favoriteChanged,
  });
}
