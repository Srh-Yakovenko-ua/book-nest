import type { NotesSummaryView } from "@app/shared";

export type NoteSummaryCounts = {
  bookNotesCount: number;
  booksWithNotesCount: number;
  favoriteCount: number;
  pinnedCount: number;
  seriesWithNotesCount: number;
  total: number;
  withSpoilerCount: number;
};

export function buildNotesSummary(counts: NoteSummaryCounts): NotesSummaryView {
  return {
    bookNotesCount: counts.bookNotesCount,
    booksWithNotesCount: counts.booksWithNotesCount,
    favoriteCount: counts.favoriteCount,
    pinnedCount: counts.pinnedCount,
    seriesNotesCount: counts.total - counts.bookNotesCount,
    seriesWithNotesCount: counts.seriesWithNotesCount,
    total: counts.total,
    withoutSpoilerCount: counts.total - counts.withSpoilerCount,
    withSpoilerCount: counts.withSpoilerCount,
  };
}
