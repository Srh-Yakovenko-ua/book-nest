import type { BookNotesSummaryView, SeriesNotesSummaryView } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { subDays } from "date-fns";

import { buildBookNotesSummary } from "../domain/book-notes-summary.js";
import { NOTES_SUMMARY_RULES } from "../domain/note-summary-leader.js";
import { toSeriesNoteAuthorLinks } from "../domain/series-note-author-links.js";
import { buildSeriesNotesSummary } from "../domain/series-notes-summary.js";
import { NotesFacetsRepository } from "../infrastructure/notes-facets.repository.js";
import { NotesSummaryRepository } from "../infrastructure/notes-summary.repository.js";
import { toBookNotesDataset, toSeriesNotesDataset } from "./note-archive-dataset.js";

const UNFILTERED_ARCHIVE_QUERY = {};

@Injectable()
export class NotesSummaryService {
  constructor(
    private readonly facetsRepository: NotesFacetsRepository,
    private readonly summaryRepository: NotesSummaryRepository,
  ) {}

  async bookSummary({ userId }: { userId: string }): Promise<BookNotesSummaryView> {
    const since = recentWindowStart(new Date());
    const dataset = toBookNotesDataset({ query: UNFILTERED_ARCHIVE_QUERY, userId });

    const [bookCounts, createdLast30DaysCount] = await Promise.all([
      this.facetsRepository.bookNoteCounts(dataset),
      this.summaryRepository.countBookNotesCreatedSince({ dataset, since }),
    ]);
    const authorLinks = await this.facetsRepository.bookAuthorLinks(
      bookCounts.map((entry) => entry.entityId),
    );

    return buildBookNotesSummary({ authorLinks, bookCounts, createdLast30DaysCount });
  }

  async seriesSummary({ userId }: { userId: string }): Promise<SeriesNotesSummaryView> {
    const since = recentWindowStart(new Date());
    const dataset = toSeriesNotesDataset({ query: UNFILTERED_ARCHIVE_QUERY, userId });

    const [seriesCounts, createdLast30DaysCount] = await Promise.all([
      this.facetsRepository.seriesNoteCounts(dataset),
      this.summaryRepository.countSeriesNotesCreatedSince({ dataset, since }),
    ]);
    const authorSources = await this.facetsRepository.seriesCanonicalAuthorSources(
      seriesCounts.map((entry) => entry.entityId),
    );

    return buildSeriesNotesSummary({
      authorLinks: toSeriesNoteAuthorLinks(authorSources),
      createdLast30DaysCount,
      seriesCounts,
    });
  }
}

function recentWindowStart(now: Date): Date {
  return subDays(now, NOTES_SUMMARY_RULES.recentWindowDays);
}
