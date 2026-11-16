import type { BookView, MarkBoughtInput, WantToBuyInput } from "@app/shared";

import { BookViewSchema, STORE_LINK_ERROR_CODES } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { isApiErrorCode } from "@/lib/api-errors";
import {
  bookOwnershipControllerMarkBought,
  bookOwnershipControllerMarkOwned,
  bookOwnershipControllerRemoveFromWishlist,
  bookOwnershipControllerRemoveOwned,
  bookOwnershipControllerWantToBuy,
} from "@/shared/api/generated/endpoints/books/books";

import { bookChangeEffects } from "./book-change-effects";
import { useBookMutationSync } from "./use-book-mutation-sync";

export function useMarkBought() {
  const queryClient = useQueryClient();
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: MarkBoughtInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookOwnershipControllerMarkBought(input.id, input.payload)),
    onError: (error) => {
      if (!isApiErrorCode(error, STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST)) return;
      void bookChangeEffects.booksChanged(queryClient, { changes: ["wishlistOutdated"] });
    },
    onSuccess: sync,
  });
}

export function useMarkOwned() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (id: string): Promise<BookView> =>
      BookViewSchema.parse(await bookOwnershipControllerMarkOwned(id)),
    onSuccess: sync,
  });
}

export function useRemoveFromWishlist() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (id: string): Promise<BookView> =>
      BookViewSchema.parse(await bookOwnershipControllerRemoveFromWishlist(id)),
    onSuccess: sync,
  });
}

export function useRemoveOwned() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (id: string): Promise<BookView> =>
      BookViewSchema.parse(await bookOwnershipControllerRemoveOwned(id)),
    onSuccess: sync,
  });
}

export function useWantToBuy() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: WantToBuyInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookOwnershipControllerWantToBuy(input.id, input.payload)),
    onSuccess: sync,
  });
}
