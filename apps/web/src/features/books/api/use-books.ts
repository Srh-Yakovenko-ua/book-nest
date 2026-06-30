import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";

import type { LibraryListParams } from "../model/library-query";

import { bookViewSchema } from "../model/book-view-schema";
import { isLibraryRangeValid } from "../model/library-query";

const libraryBooksPageSchema = z.object({
  items: z.array(bookViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

export type LibraryBooksPage = z.infer<typeof libraryBooksPageSchema>;

const MAX_PAGES = 10;

export function useLibraryBooks(params: LibraryListParams) {
  return useInfiniteQuery({
    enabled: isLibraryRangeValid(params),
    getNextPageParam: (lastPage: LibraryBooksPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    getPreviousPageParam: (firstPage: LibraryBooksPage) =>
      firstPage.page > 1 ? firstPage.page - 1 : undefined,
    initialPageParam: 1,
    maxPages: MAX_PAGES,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<LibraryBooksPage> => {
      const response = await booksControllerList({ ...params, pageNumber: pageParam });
      return libraryBooksPageSchema.parse(response);
    },
    queryKey: ["/api/books", "list", params],
  });
}
