import type { TrashedNoteView } from "@app/shared";

import { NoteEntityTypeSchema } from "@app/shared";

import type { TrashedNoteRow } from "../infrastructure/notes.repository.js";

import { TRASH_RETENTION } from "../../../core/trash-retention.js";

export function toTrashedNoteView(note: TrashedNoteRow): TrashedNoteView {
  return {
    deletedAt: note.deletedAt.toISOString(),
    entityTitle: note.book?.title ?? note.series?.name ?? null,
    entityType: NoteEntityTypeSchema.parse(note.entityType),
    id: note.id,
    purgeAt: TRASH_RETENTION.purgeAfter(note.deletedAt).toISOString(),
    text: note.text,
  };
}
