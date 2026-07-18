import type { BookStoreLinksView } from "@app/shared";

import { BookStoreLinksViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { bookStoreLinkControllerGetBookStoreLinks } from "@/shared/api/generated/endpoints/books/books";

import { storeLinkKeys } from "./store-link-keys";

export function useBookStoreLinks(bookId: string) {
  return useQuery({
    queryFn: async (): Promise<BookStoreLinksView> =>
      BookStoreLinksViewSchema.parse(await bookStoreLinkControllerGetBookStoreLinks(bookId)),
    queryKey: storeLinkKeys.forBook(bookId),
  });
}
