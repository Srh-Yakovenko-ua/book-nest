import type { BookDetailsView, Nullable } from "@app/shared";

import { BookDetailsViewSchema } from "@app/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { booksControllerGetById } from "@/shared/api/generated/endpoints/books/books";

import { bookKeys } from "./book-keys";

export function useBook(id: string) {
  return useQuery(bookQueryOptions(id));
}

export function useBookPagesCount(bookId: Nullable<string>): Nullable<number> {
  const { data } = useQuery({
    ...bookQueryOptions(bookId ?? ""),
    enabled: bookId !== null,
    select: (book) => book.pagesCount,
  });
  return data ?? null;
}

function bookQueryOptions(id: string) {
  return queryOptions({
    queryFn: async (): Promise<BookDetailsView> => {
      const response = await booksControllerGetById(id);
      return BookDetailsViewSchema.parse(response);
    },
    queryKey: bookKeys.detail(id),
    retry: false,
  });
}
