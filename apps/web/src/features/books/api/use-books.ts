import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";

import { bookViewSchema } from "../model/book-view-schema";

export type BooksSortDirection = "asc" | "desc";

const BOOKS_PAGE_SIZE = 12;

const booksPageSchema = z.object({
  items: z.array(bookViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

type BooksPage = z.infer<typeof booksPageSchema>;

export function useBooks(sortDirection: BooksSortDirection = "desc") {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: BooksPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<BooksPage> => {
      const response = await booksControllerList({
        pageNumber: pageParam,
        pageSize: BOOKS_PAGE_SIZE,
        sortDirection,
      });
      return booksPageSchema.parse(response);
    },
    queryKey: ["/api/books", "list", { sortDirection }],
  });
}
