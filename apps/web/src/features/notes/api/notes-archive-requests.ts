import type {
  NotesControllerBookFacetsParams,
  NotesControllerListBookArchiveParams,
  NotesControllerListSeriesArchiveParams,
  NotesControllerSeriesFacetsParams,
} from "@/shared/api/generated/model";

import {
  notesControllerBookFacets,
  notesControllerBookSummary,
  notesControllerListBookArchive,
  notesControllerListSeriesArchive,
  notesControllerSeriesFacets,
  notesControllerSeriesSummary,
} from "@/shared/api/generated/endpoints/notes/notes";

import type { NotesArchiveScope } from "../model/notes-archive-config";
import type { NotesDatasetParams, NotesListParams } from "../model/notes-archive-query";

import { assertNever } from "../model/assert-never";

type NotesArchivePageRequest = {
  pageNumber: number;
  params: NotesListParams;
  signal: AbortSignal;
};

export function fetchNotesArchiveFacets({
  params,
  scope,
  signal,
}: {
  params: NotesDatasetParams;
  scope: NotesArchiveScope;
  signal: AbortSignal;
}): Promise<unknown> {
  switch (scope) {
    case "books":
      return notesControllerBookFacets(toBookDatasetParams(params), { signal });
    case "series":
      return notesControllerSeriesFacets(toSeriesDatasetParams(params), { signal });
    default:
      return assertNever(scope);
  }
}

export function fetchNotesArchivePage({
  pageNumber,
  params,
  signal,
}: NotesArchivePageRequest): Promise<unknown> {
  switch (params.scope) {
    case "books":
      return notesControllerListBookArchive(toBookListParams(params, pageNumber), { signal });
    case "series":
      return notesControllerListSeriesArchive(toSeriesListParams(params, pageNumber), { signal });
    default:
      return assertNever(params);
  }
}

export function fetchNotesArchiveSummary(
  scope: NotesArchiveScope,
  signal: AbortSignal,
): Promise<unknown> {
  switch (scope) {
    case "books":
      return notesControllerBookSummary({ signal });
    case "series":
      return notesControllerSeriesSummary({ signal });
    default:
      return assertNever(scope);
  }
}

function toBookDatasetParams(params: NotesDatasetParams): NotesControllerBookFacetsParams {
  return {
    author: params.author,
    book: params.book,
    category: params.category,
    customCategory: params.customCategory,
    hasChapter: toQueryFlag(params.hasChapter),
    hasPage: toQueryFlag(params.hasPage),
    search: params.search,
  };
}

function toBookListParams(
  params: Extract<NotesListParams, { scope: "books" }>,
  pageNumber: number,
): NotesControllerListBookArchiveParams {
  return {
    ...toBookDatasetParams(params),
    filter: params.filter,
    pageNumber,
    pageSize: params.pageSize,
    sort: params.sort,
  };
}

function toQueryFlag(flag: boolean | undefined): "false" | "true" | undefined {
  if (flag === undefined) return undefined;
  return flag ? "true" : "false";
}

function toSeriesDatasetParams(params: NotesDatasetParams): NotesControllerSeriesFacetsParams {
  return {
    author: params.author,
    category: params.category,
    customCategory: params.customCategory,
    genre: params.genre,
    reading: params.reading,
    search: params.search,
    series: params.series,
    status: params.status,
  };
}

function toSeriesListParams(
  params: Extract<NotesListParams, { scope: "series" }>,
  pageNumber: number,
): NotesControllerListSeriesArchiveParams {
  return {
    ...toSeriesDatasetParams(params),
    filter: params.filter,
    pageNumber,
    pageSize: params.pageSize,
    sort: params.sort,
  };
}
