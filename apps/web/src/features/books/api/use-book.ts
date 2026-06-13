import type { BookView } from "@app/shared";

import { useQuery } from "@tanstack/react-query";

import { booksControllerGetById } from "@/shared/api/generated/endpoints/books/books";

import { bookViewSchema } from "../model/book-view-schema";

export function useBook(id: string) {
  return useQuery({
    queryFn: async (): Promise<BookView> => {
      const response = await booksControllerGetById(id);
      return bookViewSchema.parse(response);
    },
    queryKey: [`/api/books/${id}`],
    retry: false,
  });
}
