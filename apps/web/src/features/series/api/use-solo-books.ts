import { PaginatedBooksSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import type { BooksControllerListParams } from "@/shared/api/generated/model";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";
import { BooksControllerListBookType } from "@/shared/api/generated/model";

type SoloBooksPage = z.infer<typeof PaginatedBooksSchema>;

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

  return useInfiniteQuery({
    getNextPageParam: (lastPage: SoloBooksPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<SoloBooksPage> => {
      const response = await booksControllerList({
        ...EMPTY_LIST_PARAMS,
        bookType: BooksControllerListBookType.solo,
        pageNumber: pageParam,
        pageSize: SOLO_BOOKS_PAGE_SIZE,
        ...(trimmed.length > 0 ? { q: trimmed } : {}),
      });
      return PaginatedBooksSchema.parse(response);
    },
    queryKey: ["/api/books", "solo-search", trimmed],
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}
