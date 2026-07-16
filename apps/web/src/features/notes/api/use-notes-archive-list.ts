import type { NotesQuery, NoteView, Paginator } from "@app/shared";

import { PaginatedNotesSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import type { NotesControllerListParams } from "@/shared/api/generated/model";

import { notesControllerList } from "@/shared/api/generated/endpoints/notes/notes";

import { notesKeys } from "./notes-keys";

type NotesArchivePage = Paginator<NoteView>;

export function useNotesArchiveList(params: NotesQuery) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: NotesArchivePage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<NotesArchivePage> => {
      const response = await notesControllerList(
        toListParams({ ...params, pageNumber: pageParam }),
      );
      return PaginatedNotesSchema.parse(response);
    },
    queryKey: notesKeys.list(params),
    retry: false,
  });
}

function toListParams({ hasChapter, hasPage, ...rest }: NotesQuery): NotesControllerListParams {
  return {
    ...rest,
    ...(hasChapter === undefined ? {} : { hasChapter: hasChapter ? "true" : "false" }),
    ...(hasPage === undefined ? {} : { hasPage: hasPage ? "true" : "false" }),
  };
}
