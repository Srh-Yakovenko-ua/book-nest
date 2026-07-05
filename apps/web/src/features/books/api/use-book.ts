import type { BookView } from "@app/shared";

import { BookViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { booksControllerGetById } from "@/shared/api/generated/endpoints/books/books";

import { bookKeys } from "./book-keys";

export function useBook(id: string) {
  return useQuery({
    queryFn: async (): Promise<BookView> => {
      const response = await booksControllerGetById(id);
      return BookViewSchema.parse(response);
    },
    queryKey: bookKeys.detail(id),
    retry: false,
  });
}
