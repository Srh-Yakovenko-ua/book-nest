import type {
  BookStoreLinkView,
  CreateBookStoreLinkInput,
  UpdateBookStoreLinkInput,
} from "@app/shared";

import { BookStoreLinkViewSchema } from "@app/shared";
import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { invalidatePublisherQueries } from "@/features/publishers/api/publisher-keys";
import {
  bookStoreLinkControllerAddLink,
  bookStoreLinkControllerDeleteLink,
  bookStoreLinkControllerEditLink,
} from "@/shared/api/generated/endpoints/books/books";

import { storeLinkKeys } from "./store-link-keys";
import { wishlistKeys } from "./wishlist-keys";

const DELETE_STORE_LINK = {
  mutationKey: ["store-links", "delete"],
  variablesSchema: z.object({ bookId: z.string(), linkId: z.string() }),
} as const;

type DeleteStoreLinkVariables = z.infer<typeof DELETE_STORE_LINK.variablesSchema>;

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
    onSuccess: (_link, input) => {
      void sync(input.bookId);
    },
  });
}

export function useDeleteStoreLink() {
  const sync = useStoreLinkSync();

  return useMutation({
    mutationFn: async (input: DeleteStoreLinkVariables): Promise<void> => {
      await bookStoreLinkControllerDeleteLink(input.bookId, input.linkId);
    },
    mutationKey: DELETE_STORE_LINK.mutationKey,
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
    onSuccess: (_link, input) => {
      void sync(input.bookId);
    },
  });
}

export function usePendingStoreLinkDeleteIds(): string[] {
  const pendingIds = useMutationState({
    filters: { mutationKey: DELETE_STORE_LINK.mutationKey, status: "pending" },
    select: (mutation) =>
      DELETE_STORE_LINK.variablesSchema.safeParse(mutation.state.variables).data?.linkId,
  });
  return pendingIds.filter((id) => id !== undefined);
}

function useStoreLinkSync() {
  const queryClient = useQueryClient();

  return (bookId: string) => {
    void queryClient.invalidateQueries({ queryKey: wishlistKeys.root });
    void invalidatePublisherQueries(queryClient);
    return queryClient.invalidateQueries({ queryKey: storeLinkKeys.forBook(bookId) });
  };
}
