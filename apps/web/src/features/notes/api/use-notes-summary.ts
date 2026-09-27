import type {
  BookNotesSummaryView,
  NotesSummaryAuthor,
  Nullable,
  SeriesNotesSummaryView,
} from "@app/shared";

import { BookNotesSummaryViewSchema, SeriesNotesSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import type { NotesArchiveScope } from "../model/notes-archive-config";

import { fetchNotesArchiveSummary } from "./notes-archive-requests";
import { notesKeys } from "./notes-keys";

export type NotesArchiveSummary = {
  createdLast30DaysCount: number;
  denseEntitiesCount: number;
  entitiesWithNotesCount: number;
  notesCount: number;
  topAuthor: Nullable<NotesSummaryAuthor>;
  topEntity: Nullable<{ leadersCount: number; name: Nullable<string>; notesCount: number }>;
};

export function useNotesSummary(scope: NotesArchiveScope) {
  return useQuery({
    queryFn: async ({ signal }): Promise<NotesArchiveSummary> => {
      const response = await fetchNotesArchiveSummary(scope, signal);
      return scope === "books"
        ? fromBookSummary(BookNotesSummaryViewSchema.parse(response))
        : fromSeriesSummary(SeriesNotesSummaryViewSchema.parse(response));
    },
    queryKey: notesKeys.archiveSummary(scope),
    retry: false,
  });
}

function fromBookSummary(summary: BookNotesSummaryView): NotesArchiveSummary {
  return {
    createdLast30DaysCount: summary.createdLast30DaysCount,
    denseEntitiesCount: summary.booksWithFiveOrMoreNotesCount,
    entitiesWithNotesCount: summary.booksWithNotesCount,
    notesCount: summary.bookNotesCount,
    topAuthor: summary.topAuthor,
    topEntity:
      summary.topBook === null
        ? null
        : {
            leadersCount: summary.topBook.leadersCount,
            name: summary.topBook.title,
            notesCount: summary.topBook.notesCount,
          },
  };
}

function fromSeriesSummary(summary: SeriesNotesSummaryView): NotesArchiveSummary {
  return {
    createdLast30DaysCount: summary.createdLast30DaysCount,
    denseEntitiesCount: summary.seriesWithThreeOrMoreNotesCount,
    entitiesWithNotesCount: summary.seriesWithNotesCount,
    notesCount: summary.seriesNotesCount,
    topAuthor: summary.topAuthor,
    topEntity: summary.topSeries,
  };
}
