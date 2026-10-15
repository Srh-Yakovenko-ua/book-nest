import type { BookChaptersView, Nullable } from "@app/shared";

import { BookChaptersViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { bookChaptersControllerGetChapters } from "@/shared/api/generated/endpoints/books/books";

import { bookKeys } from "./book-keys";

export function useBookChapters(bookId: Nullable<string>, { enabled }: { enabled: boolean }) {
  return useQuery({
    enabled: enabled && bookId !== null,
    queryFn: async ({ signal }): Promise<BookChaptersView> =>
      BookChaptersViewSchema.parse(
        await bookChaptersControllerGetChapters(bookId ?? "", { signal }),
      ),
    queryKey: bookKeys.chapters(bookId ?? ""),
  });
}
