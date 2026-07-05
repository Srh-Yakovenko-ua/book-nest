import type { BookView, ChangeReadingStatusInput, UpdateReadingProgressInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import {
  bookReadingControllerChangeReadingStatus,
  bookReadingControllerUpdateReadingProgress,
} from "@/shared/api/generated/endpoints/books/books";

import { useBookMutationSync } from "./use-book-mutation-sync";

export function useChangeReadingStatus() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      payload: ChangeReadingStatusInput;
    }): Promise<BookView> =>
      BookViewSchema.parse(await bookReadingControllerChangeReadingStatus(input.id, input.payload)),
    onSuccess: sync,
  });
}

export function useUpdateReadingProgress() {
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      payload: UpdateReadingProgressInput;
    }): Promise<BookView> =>
      BookViewSchema.parse(
        await bookReadingControllerUpdateReadingProgress(input.id, input.payload),
      ),
    onSuccess: sync,
  });
}
