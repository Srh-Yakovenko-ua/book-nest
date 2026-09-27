import { BookNotesOverviewViewSchema, SeriesNotesOverviewViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { assertNever } from "@/lib/assert-never";
import {
  notesControllerBookOverview,
  notesControllerSeriesOverview,
} from "@/shared/api/generated/endpoints/notes/notes";

import type { NotesOverview } from "../model/notes-overview";

import { notesKeys } from "./notes-keys";

type NotesOverviewParams = { scope: "books" } | { scope: "series"; series: string[] };

export function useNotesOverview(params: NotesOverviewParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchNotesOverview(params, signal),
    queryKey: overviewKey(params),
    retry: false,
  });
}

async function fetchNotesOverview(
  params: NotesOverviewParams,
  signal: AbortSignal,
): Promise<NotesOverview> {
  switch (params.scope) {
    case "books":
      return {
        ...BookNotesOverviewViewSchema.parse(await notesControllerBookOverview({ signal })),
        scope: "books",
      };
    case "series":
      return {
        ...SeriesNotesOverviewViewSchema.parse(
          await notesControllerSeriesOverview({ series: params.series }, { signal }),
        ),
        scope: "series",
      };
    default:
      return assertNever(params);
  }
}

function overviewKey(params: NotesOverviewParams) {
  switch (params.scope) {
    case "books":
      return notesKeys.bookOverview();
    case "series":
      return notesKeys.seriesOverview(params.series);
    default:
      return assertNever(params);
  }
}
