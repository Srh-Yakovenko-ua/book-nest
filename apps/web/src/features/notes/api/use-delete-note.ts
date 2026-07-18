import { useMutation, useQueryClient } from "@tanstack/react-query";

import { noteControllerDeleteNote } from "@/shared/api/generated/endpoints/notes/notes";

import { notesKeys } from "./notes-keys";

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => noteControllerDeleteNote(noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesKeys.root });
    },
  });
}
