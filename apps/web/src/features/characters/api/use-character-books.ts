import type { z } from "zod";

import { PaginatedCharacterBooksSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

import { charactersControllerListBooks } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export type CharacterBooksPage = z.infer<typeof PaginatedCharacterBooksSchema>;

const CHARACTER_BOOKS_QUERY = {
  pageSize: 20,
  staleTime: milliseconds({ minutes: 5 }),
} as const;

type UseCharacterBooksParams = {
  characterId: string;
  enabled: boolean;
};

export function useCharacterBooks({ characterId, enabled }: UseCharacterBooksParams) {
  return useInfiniteQuery({
    enabled,
    getNextPageParam: (lastPage: CharacterBooksPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<CharacterBooksPage> =>
      PaginatedCharacterBooksSchema.parse(
        await charactersControllerListBooks(
          characterId,
          { pageNumber: pageParam, pageSize: CHARACTER_BOOKS_QUERY.pageSize },
          { signal },
        ),
      ),
    queryKey: characterKeys.books(characterId),
    staleTime: CHARACTER_BOOKS_QUERY.staleTime,
  });
}
