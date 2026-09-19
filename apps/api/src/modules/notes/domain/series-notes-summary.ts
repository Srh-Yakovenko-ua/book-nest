import type { SeriesNotesSummaryView } from "@app/shared";

import type { NoteAuthorLink, NoteEntityCount } from "./note-facets.js";

import {
  countEntitiesWithAtLeast,
  NOTES_SUMMARY_RULES,
  resolveNoteSummaryLeader,
  resolveTopAuthor,
  sumNoteCounts,
} from "./note-summary-leader.js";

export type SeriesNotesSummaryData = {
  authorLinks: NoteAuthorLink[];
  createdLast30DaysCount: number;
  seriesCounts: NoteEntityCount[];
};

export function buildSeriesNotesSummary({
  authorLinks,
  createdLast30DaysCount,
  seriesCounts,
}: SeriesNotesSummaryData): SeriesNotesSummaryView {
  const topAuthor = resolveTopAuthor({ entityCounts: seriesCounts, links: authorLinks });
  const topSeries = resolveNoteSummaryLeader(seriesCounts);

  return {
    createdLast30DaysCount,
    seriesNotesCount: sumNoteCounts(seriesCounts),
    seriesWithNotesCount: seriesCounts.length,
    seriesWithThreeOrMoreNotesCount: countEntitiesWithAtLeast({
      entityCounts: seriesCounts,
      minNotes: NOTES_SUMMARY_RULES.seriesBusyMinNotes,
    }),
    topAuthor,
    topSeries:
      topSeries === null
        ? null
        : {
            leadersCount: topSeries.leadersCount,
            name: topSeries.label,
            notesCount: topSeries.notesCount,
          },
  };
}
