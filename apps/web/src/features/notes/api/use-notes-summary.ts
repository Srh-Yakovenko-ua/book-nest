import type { NotesSummaryView } from "@app/shared";

import { NotesSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { notesControllerSummary } from "@/shared/api/generated/endpoints/notes/notes";

import { notesKeys } from "./notes-keys";

export function useNotesSummary() {
  return useQuery({
    queryFn: async (): Promise<NotesSummaryView> => {
      const response = await notesControllerSummary();
      return NotesSummaryViewSchema.parse(response);
    },
    queryKey: notesKeys.summary,
    retry: false,
  });
}
