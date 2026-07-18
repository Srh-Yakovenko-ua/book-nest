"use client";

import type { NoteEntityFilter, NoteFilter, NoteSort, NotesQuery, Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { NotesArchiveQueryState, NotesCategorySelection } from "./notes-archive-query";

import {
  categorySelectionToState,
  hasActiveNotesFilters,
  NOTES_FILTERS_RESET,
  notesArchiveParsers,
  toNotesQuery,
} from "./notes-archive-query";

export type UseNotesArchiveQueryResult = {
  clearFilters: () => void;
  clearScope: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listQuery: NotesQuery;
  setCategory: (selection: NotesCategorySelection) => void;
  setEntityType: (value: NoteEntityFilter) => void;
  setFilter: (value: NoteFilter) => void;
  setHasChapter: (value: Nullable<boolean>) => void;
  setHasPage: (value: Nullable<boolean>) => void;
  setSearch: (value: string) => void;
  setSort: (value: NoteSort) => void;
  state: NotesArchiveQueryState;
};

export function useNotesArchiveQuery(): UseNotesArchiveQueryResult {
  const [state, setState] = useQueryStates(notesArchiveParsers);

  return {
    clearFilters: () => void setState(NOTES_FILTERS_RESET),
    clearScope: () => void setState({ bookId: null, seriesId: null }),
    hasActiveFilters: hasActiveNotesFilters(state),
    hasActiveSearch: state.search.trim() !== "",
    listQuery: toNotesQuery(state),
    setCategory: (selection) => void setState(categorySelectionToState(selection)),
    setEntityType: (value) => void setState({ entityType: value }),
    setFilter: (value) => void setState({ filter: value }),
    setHasChapter: (value) => void setState({ hasChapter: value }),
    setHasPage: (value) => void setState({ hasPage: value }),
    setSearch: (value) => void setState({ search: value }),
    setSort: (value) => void setState({ sort: value }),
    state,
  };
}
