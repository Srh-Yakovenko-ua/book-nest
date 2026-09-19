import type { NoteView, Paginator } from "@app/shared";

import { PaginatedNotesSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import type { NotesListParams } from "../model/notes-archive-query";

import { fetchNotesArchivePage } from "./notes-archive-requests";
import { notesKeys } from "./notes-keys";

type NotesArchivePage = Paginator<NoteView>;

export function useNotesArchiveList(params: NotesListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: NotesArchivePage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<NotesArchivePage> =>
      PaginatedNotesSchema.parse(
        await fetchNotesArchivePage({ pageNumber: pageParam, params, signal }),
      ),
    queryKey: notesKeys.archiveList(params),
    retry: false,
  });
}
