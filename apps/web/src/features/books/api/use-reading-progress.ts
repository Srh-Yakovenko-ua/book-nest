import type { BookView, ChangeReadingStatusInput, UpdateReadingProgressInput } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { resetRelationshipReaderViews } from "@/features/character-relationships/api/relationship-mutation-effects";
import { invalidateGoalQueries } from "@/features/reading-goals/api/goal-keys";
import {
  bookReadingControllerChangeReadingStatus,
  bookReadingControllerUpdateReadingProgress,
} from "@/shared/api/generated/endpoints/books/books";

import { useBookMutationSync } from "./use-book-mutation-sync";

export function useChangeReadingStatus() {
  const queryClient = useQueryClient();
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      payload: ChangeReadingStatusInput;
    }): Promise<BookView> =>
      BookViewSchema.parse(await bookReadingControllerChangeReadingStatus(input.id, input.payload)),
    onSuccess: (book) => {
      sync(book);
      void invalidateGoalQueries(queryClient);
      void resetRelationshipReaderViews(queryClient);
    },
  });
}

export function useUpdateReadingProgress() {
  const queryClient = useQueryClient();
  const sync = useBookMutationSync();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      payload: UpdateReadingProgressInput;
    }): Promise<BookView> =>
      BookViewSchema.parse(
        await bookReadingControllerUpdateReadingProgress(input.id, input.payload),
      ),
    onSuccess: (book) => {
      sync(book);
      void invalidateGoalQueries(queryClient);
      void resetRelationshipReaderViews(queryClient);
    },
  });
}
