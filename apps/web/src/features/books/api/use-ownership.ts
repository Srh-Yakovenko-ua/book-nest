import type { BookView, MarkBoughtInput, WantToBuyInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import {
  bookOwnershipControllerMarkBought,
  bookOwnershipControllerMarkOwned,
  bookOwnershipControllerRemoveOwned,
  bookOwnershipControllerWantToBuy,
} from "@/shared/api/generated/endpoints/books/books";

import { useBookMutationSync } from "./use-book-mutation-sync";

export function useMarkBought() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: { id: string; payload: MarkBoughtInput }): Promise<BookView> =>
      BookViewSchema.parse(await bookOwnershipControllerMarkBought(input.id, input.payload)),
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
