"use client";

import type { NoteFilter } from "@app/shared";
import type { Options } from "nuqs";

import { useQueryStates } from "nuqs";

import type { NotesArchiveConfig } from "./notes-archive-config";
import type {
  NotesActiveFilterEntry,
  NotesAdvancedValues,
  NotesArchiveSnapshot,
  NotesArchiveState,
  NotesDatasetParams,
  NotesListParams,
  NotesStatePatch,
  NotesViewMode,
} from "./notes-archive-query";

import { NOTES_ARCHIVE_CONFIG } from "./notes-archive-config";
import {
  activeNotesDimensionCount,
  committedNotesSearch,
  hasActiveNotesFilters,
  NOTES_ARCHIVE,
  NOTES_ARCHIVE_PARSERS,
  notesActiveFilterEntries,
  notesClearAllPatch,
  notesFilterRemovalPatch,
  toNotesDatasetParams,
  toNotesListParams,
} from "./notes-archive-query";

export type UseNotesArchiveQueryResult = {
  activeDimensionCount: number;
  activeFilters: NotesActiveFilterEntry[];
  applyAdvanced: (values: NotesAdvancedValues) => void;
  clearAll: () => void;
  config: NotesArchiveConfig;
  datasetParams: NotesDatasetParams;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: NotesListParams;
  removeFilter: (entry: NotesActiveFilterEntry) => void;
  setFilter: (value: NoteFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: string) => void;
  setView: (value: NotesViewMode) => void;
  showBookNotes: (bookId: string) => void;
  state: NotesArchiveState;
};

type NotesArchiveUrlState = NotesArchiveSnapshot & {
  setSort: (value: string) => void;
  update: (patch: NotesStatePatch, options?: Options) => void;
};

const BOOK_NOTES_TRANSITION = { history: "push" } as const satisfies Options;

export function useBookNotesArchiveQuery(): UseNotesArchiveQueryResult {
  const [parsed, setState] = useQueryStates(NOTES_ARCHIVE_PARSERS.books);

  return notesArchiveQueryResult({
    scope: "books",
    setSort: (value) => {
      const sort = NOTES_ARCHIVE_CONFIG.books.sortOptions.find((option) => option === value);
      if (sort !== undefined) void setState({ sort });
    },
    state: { ...NOTES_ARCHIVE.emptyDimensions, ...parsed },
    update: (patch, options) => void setState(patch, options),
  });
}

export function useSeriesNotesArchiveQuery(): UseNotesArchiveQueryResult {
  const [parsed, setState] = useQueryStates(NOTES_ARCHIVE_PARSERS.series);

  return notesArchiveQueryResult({
    scope: "series",
    setSort: (value) => {
      const sort = NOTES_ARCHIVE_CONFIG.series.sortOptions.find((option) => option === value);
      if (sort !== undefined) void setState({ sort });
    },
    state: { ...NOTES_ARCHIVE.emptyDimensions, ...parsed },
    update: (patch, options) => void setState(patch, options),
  });
}

function notesArchiveQueryResult(url: NotesArchiveUrlState): UseNotesArchiveQueryResult {
  const config = NOTES_ARCHIVE_CONFIG[url.scope];
  const { state, update } = url;

  return {
    activeDimensionCount: activeNotesDimensionCount(config, state),
    activeFilters: notesActiveFilterEntries(config, state),
    applyAdvanced: (values) => update(values),
    clearAll: () => update(notesClearAllPatch(config)),
    config,
    datasetParams: toNotesDatasetParams(config, state),
    hasActiveFilters: hasActiveNotesFilters(config, state),
    hasActiveSearch: committedNotesSearch(config.searchRule, state.q) !== "",
    listParams: toNotesListParams(url),
    removeFilter: (entry) => update(notesFilterRemovalPatch(entry, state)),
    setFilter: (filter) => update({ filter }),
    setSearch: (q) => update({ q }),
    setSort: url.setSort,
    setView: (view) => update({ view }),
    showBookNotes: (bookId) =>
      update({ ...notesClearAllPatch(config), book: [bookId] }, BOOK_NOTES_TRANSITION),
    state,
  };
}
