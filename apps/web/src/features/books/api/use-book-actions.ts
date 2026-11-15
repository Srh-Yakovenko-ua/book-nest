import type { BookDetailsView, OwnershipStatus, ReadingStatus } from "@app/shared";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { BulkActionResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  booksControllerDelete,
  booksControllerUpdate,
  bulkBooksControllerDelete,
  bulkBooksControllerFavorite,
  bulkBooksControllerLists,
  bulkBooksControllerOwnershipStatus,
  bulkBooksControllerReadingQueue,
  bulkBooksControllerReadingStatus,
  bulkBooksControllerTags,
} from "@/shared/api/generated/endpoints/books/books";

import type { ListDraft } from "../model/book-organization-fields";
import type { LibraryBooksPage } from "./use-books";

import { bookChangeEffects } from "./book-change-effects";
import { bookKeys, matchesBookDetail } from "./book-keys";

type FavoriteContext = {
  snapshot: [QueryKey, InfiniteData<LibraryBooksPage> | undefined][];
};

export function useBulkAddTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; tags: string[] }) =>
      BulkActionResultSchema.parse(await bulkBooksControllerTags(input)),
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["tagged"] });
    },
  });
}

export function useBulkAddToList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; listIds: string[]; newLists: ListDraft[] }) =>
      BulkActionResultSchema.parse(
        await bulkBooksControllerLists({
          bookIds: input.bookIds,
          listIds: input.listIds,
          newLists: input.newLists,
        }),
      ),
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["listed"] });
    },
  });
}

export function useBulkAddToReadingQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookIds: string[]) =>
      BulkActionResultSchema.parse(await bulkBooksControllerReadingQueue({ bookIds })),
    onSuccess: () => {
      void bookChangeEffects.readingQueueChanged(queryClient, { change: "queueChanged" });
    },
  });
}

export function useBulkDeleteBooks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookIds: string[]) =>
      BulkActionResultSchema.parse(await bulkBooksControllerDelete({ bookIds })),
    onSuccess: (_result, bookIds) => {
      void bookChangeEffects.booksRemoved(queryClient, bookIds);
    },
  });
}

export function useBulkOwnershipStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; ownershipStatus: OwnershipStatus }) =>
      BulkActionResultSchema.parse(await bulkBooksControllerOwnershipStatus(input)),
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["statusChanged"] });
    },
  });
}

export function useBulkReadingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; readingStatus: ReadingStatus }) =>
      BulkActionResultSchema.parse(await bulkBooksControllerReadingStatus(input)),
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["statusChanged"] });
    },
  });
}

export function useBulkSetFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { bookIds: string[]; isFavorite: boolean }) =>
      BulkActionResultSchema.parse(await bulkBooksControllerFavorite(input)),
    onSuccess: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["favorited"] });
    },
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => booksControllerDelete(id),
    onSuccess: (_result, id) => {
      void bookChangeEffects.booksRemoved(queryClient, [id]);
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, { id: string; isFavorite: boolean }, FavoriteContext>({
    mutationFn: ({ id, isFavorite }) => booksControllerUpdate(id, { isFavorite }),
    onError: (_error, _input, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onMutate: async ({ id, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: bookKeys.lists });
      const snapshot = queryClient.getQueriesData<InfiniteData<LibraryBooksPage>>({
        queryKey: bookKeys.lists,
      });
      for (const [key, data] of snapshot) {
        if (data === undefined) continue;
        queryClient.setQueryData<InfiniteData<LibraryBooksPage>>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((book) => (book.id === id ? { ...book, isFavorite } : book)),
          })),
        });
      }
      return { snapshot };
    },
    onSettled: (_data, _error, { id }) => {
      void bookChangeEffects.booksChanged(queryClient, {
        changes: ["favorited"],
        keep: [matchesBookDetail(id)],
      });
    },
    onSuccess: (_data, { id, isFavorite }) => {
      const detailKey = bookKeys.detail(id);
      const cached = queryClient.getQueryData<BookDetailsView>(detailKey);
      if (cached !== undefined) {
        queryClient.setQueryData<BookDetailsView>(detailKey, { ...cached, isFavorite });
      }
    },
  });
}
