import type { z } from "zod";

import { PaginatedCharacterCatalogSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import type { CharactersControllerListParams } from "@/shared/api/generated/model";

import { charactersControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export type CharactersCatalogPage = z.infer<typeof PaginatedCharacterCatalogSchema>;

export function useCharactersCatalog(params: CharactersControllerListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: CharactersCatalogPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }): Promise<CharactersCatalogPage> =>
      PaginatedCharacterCatalogSchema.parse(
        await charactersControllerList({ ...params, pageNumber: pageParam }, { signal }),
      ),
    queryKey: characterKeys.search(params),
  });
}
