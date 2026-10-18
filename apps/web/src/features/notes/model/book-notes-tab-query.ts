import type { BookNoteSort } from "@app/shared";

import { BookNoteSearchScopeSchema } from "@app/shared";
import { type inferParserType, parseAsStringLiteral } from "nuqs/server";

import type { NotesDatasetParams, NotesListParams } from "./notes-archive-query";
import type { NotesCategorySelection } from "./notes-category-selection";

import { NOTES_ARCHIVE_CONFIG } from "./notes-archive-config";
import { committedNotesSearch, NOTES_ARCHIVE, NOTES_ARCHIVE_PARSERS } from "./notes-archive-query";

export const BOOK_NOTES_TAB = {
  pageSize: NOTES_ARCHIVE.pageSize,
  searchIn: BookNoteSearchScopeSchema.enum.notes,
  searchRule: NOTES_ARCHIVE_CONFIG.books.searchRule,
  sortDefault: "page",
  sortOptions: [
    "page",
    "newest",
    "oldest",
    "recently_updated",
    "pinned_first",
  ] as const satisfies readonly BookNoteSort[],
} as const;

export type BookNotesTabSort = (typeof BOOK_NOTES_TAB.sortOptions)[number];

export const BOOK_NOTES_TAB_PARSERS = {
  noteCategory: NOTES_ARCHIVE_PARSERS.books.category,
  noteCustomCategory: NOTES_ARCHIVE_PARSERS.books.customCategory,
  noteFilter: NOTES_ARCHIVE_PARSERS.books.filter,
  noteQ: NOTES_ARCHIVE_PARSERS.books.q,
  noteSort: parseAsStringLiteral(BOOK_NOTES_TAB.sortOptions).withDefault(
    BOOK_NOTES_TAB.sortDefault,
  ),
};

export type BookNotesTabState = inferParserType<typeof BOOK_NOTES_TAB_PARSERS>;

type BookNotesTabResetPatch = Partial<Record<keyof BookNotesTabState, null>>;

export const BOOK_NOTES_TAB_RESET = {
  filters: { noteCategory: null, noteCustomCategory: null, noteFilter: null },
  search: { noteQ: null },
} satisfies Record<string, BookNotesTabResetPatch>;

export type BookNotesListParams = Extract<NotesListParams, { scope: "books" }>;

export function bookNotesCategoryPatch(
  selection: NotesCategorySelection,
): Pick<BookNotesTabState, "noteCategory" | "noteCustomCategory"> {
  return { noteCategory: selection.category, noteCustomCategory: selection.customCategory };
}

export function committedBookNotesSearch(state: BookNotesTabState): string {
  return committedNotesSearch(BOOK_NOTES_TAB.searchRule, state.noteQ);
}

export function hasActiveBookNotesFilters(state: BookNotesTabState): boolean {
  return (
    state.noteFilter !== NOTES_ARCHIVE.filterDefault ||
    state.noteCategory.length > 0 ||
    state.noteCustomCategory.length > 0
  );
}

export function toBookNotesFacetsParams(
  bookId: string,
  state: BookNotesTabState,
): NotesDatasetParams {
  const search = committedBookNotesSearch(state);

  return {
    book: [bookId],
    searchIn: BOOK_NOTES_TAB.searchIn,
    ...(search === "" ? {} : { search }),
    ...(state.noteCategory.length === 0 ? {} : { category: state.noteCategory }),
    ...(state.noteCustomCategory.length === 0 ? {} : { customCategory: state.noteCustomCategory }),
  };
}

export function toBookNotesListParams(
  bookId: string,
  state: BookNotesTabState,
): BookNotesListParams {
  return {
    ...toBookNotesFacetsParams(bookId, state),
    filter: state.noteFilter,
    pageSize: BOOK_NOTES_TAB.pageSize,
    scope: "books",
    sort: state.noteSort,
  };
}

export function toBookNotesTabSort(value: string): BookNotesTabSort {
  return (
    BOOK_NOTES_TAB.sortOptions.find((option) => option === value) ?? BOOK_NOTES_TAB.sortDefault
  );
}
