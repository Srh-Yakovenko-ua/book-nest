import { PaginatedCharacterGlobalSummarySchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import type { CharactersControllerListParams } from "@/shared/api/generated/model";

import { charactersControllerList } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

type CharactersSearchPage = z.infer<typeof PaginatedCharacterGlobalSummarySchema>;

const SEARCH_MIN_LENGTH = 2;
const SEARCH_PAGE_SIZE = 20;

type UseCharactersSearchArgs = {
  contextBookId?: string;
  query: string;
};

export function useCharactersSearch({ contextBookId, query }: UseCharactersSearchArgs) {
  const trimmed = query.trim();
  const params: CharactersControllerListParams = {
    pageSize: SEARCH_PAGE_SIZE,
    q: trimmed,
    ...(contextBookId === undefined ? {} : { contextBookId }),
  };

  return useQuery({
    enabled: trimmed.length >= SEARCH_MIN_LENGTH,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CharactersSearchPage> =>
      PaginatedCharacterGlobalSummarySchema.parse(await charactersControllerList(params)),
    queryKey: characterKeys.search(params),
  });
}
