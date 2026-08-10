"use client";

import { useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";

import { listKeys } from "./list-keys";

export type ListCacheInvalidation = {
  booksChanged: () => void;
  favoriteChanged: () => void;
  listDuplicated: () => void;
  listEdited: () => void;
  positionChanged: () => void;
  queueChanged: () => void;
  readingStatusChanged: () => void;
};

export function useListCacheInvalidation(listId: string): ListCacheInvalidation {
  const queryClient = useQueryClient();

  function invalidate(...keys: readonly (readonly unknown[])[]) {
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }

  return {
    booksChanged: () =>
      invalidate(
        listKeys.detail(listId),
        listKeys.overview(listId),
        listKeys.facets(listId),
        listKeys.related(listId),
        listKeys.summary,
        listKeys.index,
        bookKeys.root,
      ),
    favoriteChanged: () => invalidate(listKeys.detail(listId), bookKeys.root),
    listDuplicated: () => invalidate(listKeys.index, listKeys.summary),
    listEdited: () => invalidate(listKeys.detail(listId), listKeys.index, bookKeys.root),
    positionChanged: () => invalidate(listKeys.detail(listId)),
    queueChanged: () => invalidate(listKeys.detail(listId), listKeys.overview(listId)),
    readingStatusChanged: () =>
      invalidate(listKeys.detail(listId), listKeys.overview(listId), bookKeys.root),
  };
}
