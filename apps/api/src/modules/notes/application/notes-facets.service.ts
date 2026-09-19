import type {
  BookNotesFacetsQuery,
  BookNotesFacetsView,
  SeriesNotesFacetsQuery,
  SeriesNotesFacetsView,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { toNoteQuickCounts, withoutCategoryDimension } from "../domain/note-facets.js";
import { buildBookNotesFacets, buildSeriesNotesFacets } from "../domain/notes-facets-view.js";
import { toSeriesNoteAuthorLinks } from "../domain/series-note-author-links.js";
import { NotesFacetsRepository } from "../infrastructure/notes-facets.repository.js";
import { toBookNotesDataset, toSeriesNotesDataset } from "./note-archive-dataset.js";

@Injectable()
export class NotesFacetsService {
  constructor(private readonly facetsRepository: NotesFacetsRepository) {}

  async bookFacets({
    query,
    userId,
  }: {
    query: BookNotesFacetsQuery;
    userId: string;
  }): Promise<BookNotesFacetsView> {
    const dataset = toBookNotesDataset({ query, userId });

    const [flagGroups, bookCounts, authorEntityCounts, categoryCounts] = await Promise.all([
      this.facetsRepository.bookNoteFlagGroups(dataset),
      this.facetsRepository.bookNoteCounts({ ...dataset, bookIds: undefined }),
      this.facetsRepository.bookNoteCounts({ ...dataset, authorIds: undefined }),
      this.facetsRepository.bookNoteCategoryCounts(withoutCategoryDimension(dataset)),
    ]);

    const authorLinks = await this.facetsRepository.bookAuthorLinks(
      authorEntityCounts.map((entry) => entry.entityId),
    );

    return buildBookNotesFacets({
      authorEntityCounts,
      authorLinks,
      bookCounts,
      categoryCounts,
      quickCounts: toNoteQuickCounts(flagGroups),
    });
  }

  async seriesFacets({
    query,
    userId,
  }: {
    query: SeriesNotesFacetsQuery;
    userId: string;
  }): Promise<SeriesNotesFacetsView> {
    const dataset = toSeriesNotesDataset({ query, userId });

    const [flagGroups, seriesCounts, authorEntityCounts, genreCounts, categoryCounts] =
      await Promise.all([
        this.facetsRepository.seriesNoteFlagGroups(dataset),
        this.facetsRepository.seriesNoteCounts({ ...dataset, seriesIds: undefined }),
        this.facetsRepository.seriesNoteCounts({ ...dataset, authorIds: undefined }),
        this.facetsRepository.seriesNoteGenreCounts({ ...dataset, genres: undefined }),
        this.facetsRepository.seriesNoteCategoryCounts(withoutCategoryDimension(dataset)),
      ]);

    const authorSources = await this.facetsRepository.seriesCanonicalAuthorSources(
      authorEntityCounts.map((entry) => entry.entityId),
    );

    return buildSeriesNotesFacets({
      authorEntityCounts,
      authorLinks: toSeriesNoteAuthorLinks(authorSources),
      categoryCounts,
      genreCounts,
      quickCounts: toNoteQuickCounts(flagGroups),
      seriesCounts,
    });
  }
}
