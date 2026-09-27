import type { NotesArchiveScope } from "../model/notes-archive-config";
import type { NotesDatasetParams, NotesListParams } from "../model/notes-archive-query";

export type NotesArchivePart = "facets" | "list" | "overview" | "summary";

const NOTES_ROOT = "/api/notes";
const NOTES_ARCHIVE = "archive";

function archivePart<TPart extends NotesArchivePart>(scope: NotesArchiveScope, part: TPart) {
  return [NOTES_ROOT, NOTES_ARCHIVE, scope, part] as const;
}

export const notesKeys = {
  archiveFacets: (scope: NotesArchiveScope, params: NotesDatasetParams) =>
    [...archivePart(scope, "facets"), params] as const,
  archiveList: (params: NotesListParams) => [...archivePart(params.scope, "list"), params] as const,
  archivePart,
  archiveSummary: (scope: NotesArchiveScope) => archivePart(scope, "summary"),
  bookOverview: () => archivePart("books", "overview"),
  byBook: (bookId: string) => [NOTES_ROOT, "book", bookId] as const,
  bySeries: (seriesId: string) => [NOTES_ROOT, "series", seriesId] as const,
  seriesOverview: (series: readonly string[]) =>
    [...archivePart("series", "overview"), { series }] as const,
};
