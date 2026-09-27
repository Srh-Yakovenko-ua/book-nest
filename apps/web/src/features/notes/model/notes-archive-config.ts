import type { BookNoteSort, NoteEntityType, SeriesNoteSort, ValueOf } from "@app/shared";

import { BookNoteSortSchema, SeriesNoteSortSchema } from "@app/shared";

export type NoteArchiveSort = ValueOf<NotesArchiveSortByScope>;

export type NotesArchiveConfig = {
  dimensions: readonly NotesArchiveDimension[];
  entityDimension: Extract<NotesFacetDimension, "book" | "series">;
  entityType: NoteEntityType;
  route: string;
  scope: NotesArchiveScope;
  searchRule: NotesSearchRule;
  sortOptions: readonly NoteArchiveSort[];
};

export type NotesArchiveDimension = "category" | NotesMultiDimension | NotesPresenceDimension;

export type NotesArchiveScope = "books" | "series";

export type NotesArchiveSortByScope = {
  books: BookNoteSort;
  series: SeriesNoteSort;
};

export type NotesFacetDimension = "author" | "book" | "genre" | "series";

export type NotesMultiDimension = "reading" | "status" | NotesFacetDimension;

export type NotesPresenceDimension = "hasChapter" | "hasPage";

export type NotesSearchRule = "text" | "text_or_page_number";

export const NOTES_ARCHIVE_CONFIG = {
  books: {
    dimensions: ["book", "author", "category", "hasPage", "hasChapter"],
    entityDimension: "book",
    entityType: "book",
    route: "/notes/books",
    scope: "books",
    searchRule: "text_or_page_number",
    sortOptions: BookNoteSortSchema.options,
  },
  series: {
    dimensions: ["series", "author", "genre", "category", "status", "reading"],
    entityDimension: "series",
    entityType: "series",
    route: "/notes/series",
    scope: "series",
    searchRule: "text",
    sortOptions: SeriesNoteSortSchema.options,
  },
} as const satisfies Record<NotesArchiveScope, NotesArchiveConfig>;

export const NOTES_ARCHIVE_SCOPE_BY_ENTITY = {
  book: "books",
  series: "series",
} as const satisfies Record<NoteEntityType, NotesArchiveScope>;
