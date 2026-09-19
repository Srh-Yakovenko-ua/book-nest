import type { BookNotesSummaryView } from "@app/shared";

import type { NoteAuthorLink, NoteEntityCount } from "./note-facets.js";

import {
  countEntitiesWithAtLeast,
  NOTES_SUMMARY_RULES,
  resolveNoteSummaryLeader,
  resolveTopAuthor,
  sumNoteCounts,
} from "./note-summary-leader.js";

export type BookNotesSummaryData = {
  authorLinks: NoteAuthorLink[];
  bookCounts: NoteEntityCount[];
  createdLast30DaysCount: number;
};

export function buildBookNotesSummary({
  authorLinks,
  bookCounts,
  createdLast30DaysCount,
}: BookNotesSummaryData): BookNotesSummaryView {
  const topAuthor = resolveTopAuthor({ entityCounts: bookCounts, links: authorLinks });
  const topBook = resolveNoteSummaryLeader(bookCounts);

  return {
    bookNotesCount: sumNoteCounts(bookCounts),
    booksWithFiveOrMoreNotesCount: countEntitiesWithAtLeast({
      entityCounts: bookCounts,
      minNotes: NOTES_SUMMARY_RULES.bookBusyMinNotes,
    }),
    booksWithNotesCount: bookCounts.length,
    createdLast30DaysCount,
    topAuthor,
    topBook:
      topBook === null
        ? null
        : {
            leadersCount: topBook.leadersCount,
            notesCount: topBook.notesCount,
            title: topBook.label,
          },
  };
}
