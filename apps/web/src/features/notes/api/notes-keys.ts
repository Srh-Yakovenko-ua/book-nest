import type { NotesQuery } from "@app/shared";

const NOTES_ROOT = "/api/notes";

export const notesKeys = {
  byBook: (bookId: string) => [NOTES_ROOT, "book", bookId] as const,
  bySeries: (seriesId: string) => [NOTES_ROOT, "series", seriesId] as const,
  list: (params: NotesQuery) => [NOTES_ROOT, "list", params] as const,
  root: [NOTES_ROOT] as const,
  summary: [NOTES_ROOT, "summary"] as const,
};
