import type { NotePostFinishReviewInput, NoteRediscoveryImpressionInput } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  notesControllerRecordRediscoveryImpression,
  notesControllerReviewPostFinish,
} from "@/shared/api/generated/endpoints/notes/notes";

import { notesKeys } from "./notes-keys";

export function useRecordNoteRediscoveryImpression() {
  return useMutation({
    mutationFn: async ({ impressionKey }: NoteRediscoveryImpressionInput): Promise<void> => {
      await notesControllerRecordRediscoveryImpression({ impressionKey });
    },
  });
}

export function useReviewNotesPostFinish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ readingCycleId }: NotePostFinishReviewInput): Promise<void> => {
      await notesControllerReviewPostFinish({ readingCycleId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesKeys.bookOverview() });
    },
  });
}
