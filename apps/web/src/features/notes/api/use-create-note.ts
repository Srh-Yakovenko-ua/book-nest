import type { CreateNoteInput, NoteEntityType, NoteView } from "@app/shared";

import { NoteViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateNoteInputDto } from "@/shared/api/generated/model";

import {
  noteControllerCreateBookNote,
  noteControllerCreateSeriesNote,
} from "@/shared/api/generated/endpoints/notes/notes";

import type { NoteEntityRef } from "../model/note-entity";

import { noteEntityId } from "../model/note-entity";
import { notesKeys } from "./notes-keys";

type CreateNoteEndpoint = (id: string, body: CreateNoteInputDto) => Promise<unknown>;

type CreateNoteVariables = {
  entity: NoteEntityRef;
  input: CreateNoteInput;
};

const CREATE_NOTE_ENDPOINTS = {
  book: noteControllerCreateBookNote,
  series: noteControllerCreateSeriesNote,
} as const satisfies Record<NoteEntityType, CreateNoteEndpoint>;

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entity, input }: CreateNoteVariables): Promise<NoteView> => {
      const createForEntity = CREATE_NOTE_ENDPOINTS[entity.type];
      const response = await createForEntity(noteEntityId(entity), input);
      return NoteViewSchema.parse(response);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesKeys.root });
    },
  });
}
