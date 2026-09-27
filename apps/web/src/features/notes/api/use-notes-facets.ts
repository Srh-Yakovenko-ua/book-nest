import type {
  BookNotesFacetsView,
  NoteCategoryFacet,
  NoteQuickCounts,
  NoteValueFacet,
  SeriesNotesFacetsView,
} from "@app/shared";

import { BookNotesFacetsViewSchema, SeriesNotesFacetsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { FacetOption } from "@/components/facet-multiselect";

import type { NotesArchiveScope, NotesFacetDimension } from "../model/notes-archive-config";
import type { NotesDatasetParams } from "../model/notes-archive-query";

import { fetchNotesArchiveFacets } from "./notes-archive-requests";
import { notesKeys } from "./notes-keys";

export type NotesArchiveFacets = {
  categories: NoteCategoryFacet[];
  customCategories: NoteValueFacet[];
  options: Record<NotesFacetDimension, FacetOption[]>;
  quickCounts: NoteQuickCounts;
};

export function useNotesFacets(scope: NotesArchiveScope, params: NotesDatasetParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<NotesArchiveFacets> => {
      const response = await fetchNotesArchiveFacets({ params, scope, signal });
      return scope === "books"
        ? fromBookFacets(BookNotesFacetsViewSchema.parse(response))
        : fromSeriesFacets(SeriesNotesFacetsViewSchema.parse(response));
    },
    queryKey: notesKeys.archiveFacets(scope, params),
    retry: false,
  });
}

function fromBookFacets(facets: BookNotesFacetsView): NotesArchiveFacets {
  return {
    categories: facets.categories,
    customCategories: facets.customCategories,
    options: {
      author: facets.authors.map(({ count, id, name }) => ({ count, label: name, value: id })),
      book: facets.books.map(({ count, id, title }) => ({ count, label: title, value: id })),
      genre: [],
      series: [],
    },
    quickCounts: facets.quickCounts,
  };
}

function fromSeriesFacets(facets: SeriesNotesFacetsView): NotesArchiveFacets {
  return {
    categories: facets.categories,
    customCategories: facets.customCategories,
    options: {
      author: facets.authors.map(({ count, id, name }) => ({ count, label: name, value: id })),
      book: [],
      genre: facets.genres.map(({ count, value }) => ({ count, label: value, value })),
      series: facets.series.map(({ count, id, name }) => ({ count, label: name, value: id })),
    },
    quickCounts: facets.quickCounts,
  };
}
