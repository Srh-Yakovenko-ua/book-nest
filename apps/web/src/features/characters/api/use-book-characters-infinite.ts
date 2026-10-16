import { PaginatedBookCharacterRosterSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import { bookCharactersControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import type { BookCharactersPage } from "./use-book-characters";

import { characterKeys } from "./character-keys";

export function useBookCharactersInfinite(
  bookId: string,
  params: BookCharactersControllerListParams,
) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: BookCharactersPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<BookCharactersPage> =>
      PaginatedBookCharacterRosterSchema.parse(
        await bookCharactersControllerList(
          bookId,
          { ...params, pageNumber: pageParam },
          { signal },
        ),
      ),
    queryKey: characterKeys.bookRosterInfinite(bookId, params),
  });
}
