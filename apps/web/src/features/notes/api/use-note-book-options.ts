import type { BookView } from "@app/shared";

import { PaginatedBooksSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BooksControllerListParams } from "@/shared/api/generated/model";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";

const BOOK_OPTIONS_PAGE_SIZE = 20;

const EMPTY_LIST_PARAMS = {
  ageCategory: [],
  author: [],
  format: [],
  genre: [],
  language: [],
  owner: [],
  publisher: [],
  status: [],
  tag: [],
} satisfies Partial<BooksControllerListParams>;

export function useNoteBookOptions(search: string) {
  const trimmed = search.trim();

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<BookView[]> => {
      const response = await booksControllerList(
        {
          ...EMPTY_LIST_PARAMS,
          pageNumber: 1,
          pageSize: BOOK_OPTIONS_PAGE_SIZE,
          ...(trimmed.length > 0 ? { q: trimmed } : {}),
        },
        { signal },
      );
      return PaginatedBooksSchema.parse(response).items;
    },
    queryKey: ["/api/books", "note-entity-options", trimmed],
  });
}
