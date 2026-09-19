import type { NoteView } from "@app/shared";

import { NoteViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  noteControllerCreateBookNote,
  noteControllerCreateSeriesNote,
} from "@/shared/api/generated/endpoints/notes/notes";

import type { NoteCreateRequest } from "../model/note-form-schema";

import { assertNever } from "../model/assert-never";
import { refreshAfterNoteMutation } from "./note-mutation-effects";

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: NoteCreateRequest): Promise<NoteView> =>
      NoteViewSchema.parse(await sendCreateNote(request)),
    onSuccess: (note) => {
      void refreshAfterNoteMutation(queryClient, { kind: "create", note });
    },
  });
}

function sendCreateNote(request: NoteCreateRequest): Promise<unknown> {
  switch (request.type) {
    case "book":
      return noteControllerCreateBookNote(request.book.id, request.input);
    case "series":
      return noteControllerCreateSeriesNote(request.series.id, request.input);
    default:
      return assertNever(request);
  }
}
