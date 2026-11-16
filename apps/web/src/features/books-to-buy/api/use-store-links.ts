import type {
  BookStoreLinkView,
  CreateBookStoreLinkInput,
  UpdateBookStoreLinkInput,
} from "@app/shared";

import { BookStoreLinkViewSchema } from "@app/shared";
import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
  bookStoreLinkControllerAddLink,
  bookStoreLinkControllerDeleteLink,
  bookStoreLinkControllerEditLink,
} from "@/shared/api/generated/endpoints/books/books";

import { storeLinkChangeEffects } from "./store-link-change-effects";

const DELETE_STORE_LINK = {
  mutationKey: ["store-links", "delete"],
  variablesSchema: z.object({ bookId: z.string(), linkId: z.string() }),
} as const;

type DeleteStoreLinkVariables = z.infer<typeof DELETE_STORE_LINK.variablesSchema>;

export function useAddStoreLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      payload: CreateBookStoreLinkInput;
    }): Promise<BookStoreLinkView> =>
      BookStoreLinkViewSchema.parse(
        await bookStoreLinkControllerAddLink(input.bookId, input.payload),
      ),
    onSuccess: (_link, input) => {
      void storeLinkChangeEffects.storeLinksChanged(queryClient, { bookId: input.bookId });
    },
  });
}

export function useDeleteStoreLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteStoreLinkVariables): Promise<void> => {
      await bookStoreLinkControllerDeleteLink(input.bookId, input.linkId);
    },
    mutationKey: DELETE_STORE_LINK.mutationKey,
    onSuccess: (_result, input) =>
      storeLinkChangeEffects.storeLinksChanged(queryClient, { bookId: input.bookId }),
  });
}

export function useEditStoreLink() {
  const queryClient = useQueryClient();

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
      void storeLinkChangeEffects.storeLinksChanged(queryClient, { bookId: input.bookId });
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
