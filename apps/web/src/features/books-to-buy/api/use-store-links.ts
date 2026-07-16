import type {
  BookStoreLinkView,
  CreateBookStoreLinkInput,
  UpdateBookStoreLinkInput,
} from "@app/shared";

import { BookStoreLinkViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  bookStoreLinkControllerAddLink,
  bookStoreLinkControllerDeleteLink,
  bookStoreLinkControllerEditLink,
} from "@/shared/api/generated/endpoints/books/books";

import { storeLinkKeys } from "./store-link-keys";
import { wishlistKeys } from "./wishlist-keys";

export function useAddStoreLink() {
  const sync = useStoreLinkSync();

  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      payload: CreateBookStoreLinkInput;
    }): Promise<BookStoreLinkView> =>
      BookStoreLinkViewSchema.parse(
        await bookStoreLinkControllerAddLink(input.bookId, input.payload),
      ),
    onSuccess: (_link, input) => sync(input.bookId),
  });
}

export function useDeleteStoreLink() {
  const sync = useStoreLinkSync();

  return useMutation({
    mutationFn: async (input: { bookId: string; linkId: string }): Promise<void> => {
      await bookStoreLinkControllerDeleteLink(input.bookId, input.linkId);
    },
    onSuccess: (_result, input) => sync(input.bookId),
  });
}

export function useEditStoreLink() {
  const sync = useStoreLinkSync();

  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      linkId: string;
      payload: UpdateBookStoreLinkInput;
    }): Promise<BookStoreLinkView> =>
      BookStoreLinkViewSchema.parse(
        await bookStoreLinkControllerEditLink(input.bookId, input.linkId, input.payload),
      ),
    onSuccess: (_link, input) => sync(input.bookId),
  });
}

function useStoreLinkSync() {
  const queryClient = useQueryClient();

  return (bookId: string) => {
    void queryClient.invalidateQueries({ queryKey: wishlistKeys.root });
    void queryClient.invalidateQueries({ queryKey: storeLinkKeys.forBook(bookId) });
  };
}
