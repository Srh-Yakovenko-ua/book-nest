import type { NoteView, UpdateNoteInput } from "@app/shared";

import { NoteViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { noteControllerEditNote } from "@/shared/api/generated/endpoints/notes/notes";

import { notesKeys } from "./notes-keys";

type UpdateNoteVariables = {
  input: UpdateNoteInput;
  noteId: string;
};

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, noteId }: UpdateNoteVariables): Promise<NoteView> => {
      const response = await noteControllerEditNote(noteId, input);
      return NoteViewSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesKeys.root });
    },
  });
}
