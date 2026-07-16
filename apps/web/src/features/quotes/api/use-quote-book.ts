import type { BookView, Nullable } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { booksControllerGetById } from "@/shared/api/generated/endpoints/books/books";

export function useQuoteBook(bookId: Nullable<string>) {
  return useQuery({
    enabled: bookId !== null,
    queryFn: async (): Promise<BookView> =>
      BookViewSchema.parse(await booksControllerGetById(bookId ?? "")),
    queryKey: bookKeys.detail(bookId ?? ""),
    retry: false,
  });
}
