import { PaginatedBooksSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import type { BooksControllerListParams } from "@/shared/api/generated/model";

import { booksControllerList } from "@/shared/api/generated/endpoints/books/books";
import { BooksControllerListSort } from "@/shared/api/generated/model";

type CharacterBookOptionsPage = z.infer<typeof PaginatedBooksSchema>;

const CHARACTER_BOOK_OPTIONS_QUERY = {
  pageSize: 20,
  sort: BooksControllerListSort.title_asc,
} as const satisfies BooksControllerListParams;

export function useCharacterBookOptions(
  search: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const trimmed = search.trim();
  const params: BooksControllerListParams = {
    ...CHARACTER_BOOK_OPTIONS_QUERY,
    ...(trimmed === "" ? {} : { q: trimmed }),
  };

  return useInfiniteQuery({
    enabled,
    getNextPageParam: (lastPage: CharacterBookOptionsPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<CharacterBookOptionsPage> =>
      PaginatedBooksSchema.parse(
        await booksControllerList({ ...params, pageNumber: pageParam }, { signal }),
      ),
    queryKey: ["/api/books", "character-filter-options", params],
  });
}
