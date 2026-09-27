import type { ValueOf } from "@app/shared";

import { PaginatedBooksSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";

import type { LibraryListParams } from "../model/library-query";

import { isLibraryRangeValid } from "../model/library-query";

export type LibraryBooksPage = z.infer<typeof PaginatedBooksSchema>;

export const LIBRARY_BOOKS_RETENTION = {
  paged: { maxPages: 10 },
  whole: { maxPages: 0, staleTime: Number.POSITIVE_INFINITY },
} as const;

type LibraryBooksOptions = {
  retention?: LibraryBooksRetention;
};

type LibraryBooksRetention = ValueOf<typeof LIBRARY_BOOKS_RETENTION>;

export function useLibraryBooks(params: LibraryListParams, options?: LibraryBooksOptions) {
  const retention = options?.retention ?? LIBRARY_BOOKS_RETENTION.paged;

  return useInfiniteQuery({
    ...retention,
    enabled: isLibraryRangeValid(params),
    getNextPageParam: (lastPage: LibraryBooksPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    getPreviousPageParam: (firstPage: LibraryBooksPage) =>
      firstPage.page > 1 ? firstPage.page - 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<LibraryBooksPage> => {
      const response = await booksControllerList({ ...params, pageNumber: pageParam });
      return PaginatedBooksSchema.parse(response);
    },
    queryKey: ["/api/books", "list", params, retention],
  });
}
