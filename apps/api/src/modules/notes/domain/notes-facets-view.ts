import type {
  BookNotesFacetsView,
  NoteQuickCounts,
  NoteValueFacet,
  SeriesNotesFacetsView,
} from "@app/shared";

import {
  type NoteAuthorLink,
  type NoteCategoryCount,
  type NoteEntityCount,
  rankEntityCounts,
  toAuthorFacets,
  toCategoryFacets,
  toValueFacets,
} from "./note-facets.js";

type SharedFacetsData = {
  authorEntityCounts: NoteEntityCount[];
  authorLinks: NoteAuthorLink[];
  categoryCounts: NoteCategoryCount[];
  quickCounts: NoteQuickCounts;
};

export function buildBookNotesFacets({
  bookCounts,
  ...shared
}: SharedFacetsData & { bookCounts: NoteEntityCount[] }): BookNotesFacetsView {
  return {
    ...buildSharedFacets(shared),
    books: rankEntityCounts(bookCounts).map((entry) => ({
      count: entry.count,
      id: entry.entityId,
      title: entry.label,
    })),
  };
}

export function buildSeriesNotesFacets({
  genreCounts,
  seriesCounts,
  ...shared
}: SharedFacetsData & {
  genreCounts: NoteValueFacet[];
  seriesCounts: NoteEntityCount[];
}): SeriesNotesFacetsView {
  return {
    ...buildSharedFacets(shared),
    genres: toValueFacets(genreCounts),
    series: rankEntityCounts(seriesCounts).map((entry) => ({
      count: entry.count,
      id: entry.entityId,
      name: entry.label,
    })),
  };
}

function buildSharedFacets({
  authorEntityCounts,
  authorLinks,
  categoryCounts,
  quickCounts,
}: SharedFacetsData): Pick<
  BookNotesFacetsView,
  "authors" | "categories" | "customCategories" | "quickCounts"
> {
  return {
    ...toCategoryFacets(categoryCounts),
    authors: toAuthorFacets({ entityCounts: authorEntityCounts, links: authorLinks }),
    quickCounts,
  };
}
