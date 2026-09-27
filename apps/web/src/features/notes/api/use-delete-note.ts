import type { NoteView } from "@app/shared";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { noteControllerDeleteNote } from "@/shared/api/generated/endpoints/notes/notes";

import { refreshAfterNoteMutation } from "./note-mutation-effects";

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: NoteView) => noteControllerDeleteNote(note.id),
    onSuccess: (_response, note) => refreshAfterNoteMutation(queryClient, { kind: "delete", note }),
  });
}
