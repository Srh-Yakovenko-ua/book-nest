import type { NoteEntityType, Nullable, TrashedNoteView } from "@app/shared";

import { NoteEntityTypeSchema } from "@app/shared";

import type { TrashedNoteRow } from "../infrastructure/notes.repository.js";

const ENTITY_TITLE = {
  book: (note: TrashedNoteRow) => note.book?.title ?? null,
  series: (note: TrashedNoteRow) => note.series?.name ?? null,
} satisfies Record<NoteEntityType, (note: TrashedNoteRow) => Nullable<string>>;

export function toTrashedNoteView(note: TrashedNoteRow): TrashedNoteView {
  const entityType = NoteEntityTypeSchema.parse(note.entityType);

  return {
    deletedAt: note.deletedAt.toISOString(),
    entityTitle: ENTITY_TITLE[entityType](note),
    entityType,
    id: note.id,
    purgeAt: note.purgeAt.toISOString(),
    text: note.text,
  };
}
