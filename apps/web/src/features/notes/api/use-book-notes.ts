import type { EntityNotesView } from "@app/shared";

import { EntityNotesViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { noteControllerListBookNotes } from "@/shared/api/generated/endpoints/notes/notes";

import { notesKeys } from "./notes-keys";

export function useBookNotes(bookId: string) {
  return useQuery({
    queryFn: async (): Promise<EntityNotesView> => {
      const response = await noteControllerListBookNotes(bookId);
      return EntityNotesViewSchema.parse(response);
    },
    queryKey: notesKeys.byBook(bookId),
    retry: false,
  });
}
