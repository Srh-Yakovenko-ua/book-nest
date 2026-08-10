import type { BulkActionResult, RemoveBooksFromListResult } from "@app/shared";

import { BulkActionResultSchema, RemoveBooksFromListResultSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import type { ListDraft } from "@/features/books/model/book-organization-fields";

import {
  bulkBooksControllerFavorite,
  bulkBooksControllerLists,
  bulkBooksControllerReadingQueue,
} from "@/shared/api/generated/endpoints/books/books";
import { listMembershipControllerRemoveBooks } from "@/shared/api/generated/endpoints/lists/lists";

import { useListCacheInvalidation } from "./use-list-cache";

export function useBulkAddListBooksToLists(listId: string) {
  const cache = useListCacheInvalidation(listId);

  return useMutation({
    mutationFn: async (input: {
      bookIds: string[];
      listIds: string[];
      newLists: ListDraft[];
    }): Promise<BulkActionResult> =>
      BulkActionResultSchema.parse(await bulkBooksControllerLists(input)),
    onSuccess: cache.booksChanged,
  });
}

export function useBulkAddListBooksToQueue(listId: string) {
  const cache = useListCacheInvalidation(listId);

  return useMutation({
    mutationFn: async (bookIds: string[]): Promise<BulkActionResult> =>
      BulkActionResultSchema.parse(await bulkBooksControllerReadingQueue({ bookIds })),
    onSuccess: cache.queueChanged,
  });
}

export function useBulkRemoveBooksFromList(listId: string) {
  const cache = useListCacheInvalidation(listId);

  return useMutation({
    mutationFn: async (bookIds: string[]): Promise<RemoveBooksFromListResult> =>
      RemoveBooksFromListResultSchema.parse(
        await listMembershipControllerRemoveBooks(listId, { bookIds }),
      ),
    onSuccess: cache.booksChanged,
  });
}

export function useBulkSetListBooksFavorite(listId: string) {
  const cache = useListCacheInvalidation(listId);

  return useMutation({
    mutationFn: async (input: {
      bookIds: string[];
      isFavorite: boolean;
    }): Promise<BulkActionResult> =>
      BulkActionResultSchema.parse(await bulkBooksControllerFavorite(input)),
    onSuccess: cache.favoriteChanged,
  });
}
