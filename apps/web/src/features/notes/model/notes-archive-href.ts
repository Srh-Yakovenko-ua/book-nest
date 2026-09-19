import type { NoteEntityType } from "@app/shared";

import { createSerializer } from "nuqs/server";

import { NOTES_ARCHIVE_CONFIG } from "./notes-archive-config";
import { NOTES_ARCHIVE_PARSERS } from "./notes-archive-query";

const serializeNotesArchive = {
  books: createSerializer(NOTES_ARCHIVE_PARSERS.books),
  series: createSerializer(NOTES_ARCHIVE_PARSERS.series),
};

export function notesArchiveHref(entityType: NoteEntityType, entityId: string): string {
  if (entityType === "book") {
    return serializeNotesArchive.books(NOTES_ARCHIVE_CONFIG.books.route, { book: [entityId] });
  }

  return serializeNotesArchive.series(NOTES_ARCHIVE_CONFIG.series.route, { series: [entityId] });
}
