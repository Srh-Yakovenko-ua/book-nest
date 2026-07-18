import type { EntityNotesView } from "@app/shared";

import { EntityNotesViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { noteControllerListSeriesNotes } from "@/shared/api/generated/endpoints/notes/notes";

import { notesKeys } from "./notes-keys";

export function useSeriesNotes(seriesId: string) {
  return useQuery({
    queryFn: async (): Promise<EntityNotesView> => {
      const response = await noteControllerListSeriesNotes(seriesId);
      return EntityNotesViewSchema.parse(response);
    },
    queryKey: notesKeys.bySeries(seriesId),
    retry: false,
  });
}
