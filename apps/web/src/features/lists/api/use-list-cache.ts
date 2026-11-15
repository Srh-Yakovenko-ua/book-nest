"use client";

import { useQueryClient } from "@tanstack/react-query";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";
import { invalidateBookQueries } from "@/features/books/api/book-keys";

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
    booksChanged: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["listed"] });
    },
    favoriteChanged: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["favorited"] });
    },
    listDuplicated: () => invalidate(listKeys.index, listKeys.summary),
    listEdited: () => {
      invalidate(listKeys.detail(listId), listKeys.index);
      void invalidateBookQueries(queryClient);
    },
    positionChanged: () => invalidate(listKeys.detail(listId)),
    queueChanged: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["queueChanged"] });
    },
    readingStatusChanged: () => {
      void bookChangeEffects.booksChanged(queryClient, { changes: ["statusChanged"] });
    },
  };
}
