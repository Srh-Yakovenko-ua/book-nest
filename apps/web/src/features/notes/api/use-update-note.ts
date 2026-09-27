import type { NoteView, UpdateNoteInput } from "@app/shared";

import { NoteViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { noteControllerEditNote } from "@/shared/api/generated/endpoints/notes/notes";

import type { NoteRefreshTiming } from "./note-mutation-effects";

import { refreshAfterNoteMutation, writeUpdatedNote } from "./note-mutation-effects";

type UpdateNoteVariables = {
  input: UpdateNoteInput;
  noteId: string;
};

export function useUpdateNote({ refresh = "awaited" }: { refresh?: NoteRefreshTiming } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, noteId }: UpdateNoteVariables): Promise<NoteView> => {
      const response = await noteControllerEditNote(noteId, input);
      return NoteViewSchema.parse(response);
    },
    onSuccess: (note) => {
      writeUpdatedNote(queryClient, note);
      const refreshed = refreshAfterNoteMutation(queryClient, { kind: "update", note });
      return refresh === "awaited" ? refreshed : undefined;
    },
  });
}
