import type { BookView } from "@app/shared";

import { PaginatedBooksSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { BooksControllerListParams } from "@/shared/api/generated/model";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";
import { BooksControllerListBookType } from "@/shared/api/generated/model";

const SOLO_BOOKS_PAGE_SIZE = 20;

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

export function useSoloBooks(search: string) {
  const trimmed = search.trim();

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BookView[]> => {
      const response = await booksControllerList({
        ...EMPTY_LIST_PARAMS,
        bookType: BooksControllerListBookType.solo,
        pageNumber: 1,
        pageSize: SOLO_BOOKS_PAGE_SIZE,
        ...(trimmed.length > 0 ? { q: trimmed } : {}),
      });
      return PaginatedBooksSchema.parse(response).items;
    },
    queryKey: ["/api/books", "solo-search", trimmed],
  });
}
