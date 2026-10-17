import {
  CHARACTER_FACTS_PAGE_SIZE,
  type PaginatedCharacterFacts,
  PaginatedCharacterFactsSchema,
} from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { characterFactsControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { toCharacterFactsSearch } from "../model/character-details-query";
import { type CharacterFactsScope, characterKeys } from "./character-keys";

export function useCharacterFactsInfinite({
  bookId,
  characterId,
  q,
}: CharacterFactsScope & { q: string }) {
  const search = toCharacterFactsSearch(q);

  return useInfiniteQuery({
    getNextPageParam: (lastPage: PaginatedCharacterFacts) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<PaginatedCharacterFacts> =>
      PaginatedCharacterFactsSchema.parse(
        await characterFactsControllerList(
          bookId,
          characterId,
          {
            pageNumber: pageParam,
            pageSize: CHARACTER_FACTS_PAGE_SIZE,
            ...(search === "" ? {} : { q: search }),
          },
          { signal },
        ),
      ),
    queryKey: characterKeys.factsInfinite({ bookId, characterId, q: search }),
  });
}
