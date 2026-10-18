"use client";

import type { NoteFilter } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  BookNotesListParams,
  BookNotesTabSort,
  BookNotesTabState,
} from "./book-notes-tab-query";
import type { NotesDatasetParams } from "./notes-archive-query";
import type { NotesCategorySelection } from "./notes-category-selection";

import {
  BOOK_NOTES_TAB_PARSERS,
  BOOK_NOTES_TAB_RESET,
  bookNotesCategoryPatch,
  committedBookNotesSearch,
  hasActiveBookNotesFilters,
  toBookNotesFacetsParams,
  toBookNotesListParams,
} from "./book-notes-tab-query";

export type UseBookNotesTabQueryResult = {
  clearFilters: () => void;
  clearSearch: () => void;
  facetsParams: NotesDatasetParams;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: BookNotesListParams;
  setCategories: (selection: NotesCategorySelection) => void;
  setFilter: (value: NoteFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: BookNotesTabSort) => void;
  state: BookNotesTabState;
};

export function useBookNotesTabQuery(bookId: string): UseBookNotesTabQueryResult {
  const [state, setState] = useQueryStates(BOOK_NOTES_TAB_PARSERS);

  return {
    clearFilters: () => void setState(BOOK_NOTES_TAB_RESET.filters),
    clearSearch: () => void setState(BOOK_NOTES_TAB_RESET.search),
    facetsParams: toBookNotesFacetsParams(bookId, state),
    hasActiveFilters: hasActiveBookNotesFilters(state),
    hasActiveSearch: committedBookNotesSearch(state) !== "",
    listParams: toBookNotesListParams(bookId, state),
    setCategories: (selection) => void setState(bookNotesCategoryPatch(selection)),
    setFilter: (noteFilter) => void setState({ noteFilter }),
    setSearch: (noteQ) => void setState({ noteQ }),
    setSort: (noteSort) => void setState({ noteSort }),
    state,
  };
}
