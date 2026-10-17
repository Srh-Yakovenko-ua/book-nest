import { PaginatedCharacterFactsSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { characterFactsControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { type CharacterFactsScope, characterKeys } from "./character-keys";

const FACTS_TOTAL_REQUEST = {
  pageNumber: 1,
  pageSize: 1,
} as const;

export function useCharacterFactsTotal({
  bookId,
  characterId,
  enabled,
}: CharacterFactsScope & { enabled: boolean }) {
  return useQuery({
    enabled,
    gcTime: 0,
    queryFn: async ({ signal }): Promise<number> =>
      PaginatedCharacterFactsSchema.parse(
        await characterFactsControllerList(bookId, characterId, FACTS_TOTAL_REQUEST, { signal }),
      ).totalCount,
    queryKey: characterKeys.factsTotal({ bookId, characterId }),
    retry: false,
    staleTime: 0,
  });
}
