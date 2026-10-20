import type { CharacterFacetsView } from "@app/shared";

import { CharacterFacetsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { CharactersControllerFacetsParams } from "@/shared/api/generated/model";

import { charactersControllerFacets } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

type UseCharacterFacetsOptions = {
  enabled: boolean;
};

export function useCharacterFacets(
  params: CharactersControllerFacetsParams,
  { enabled }: UseCharacterFacetsOptions,
) {
  return useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<CharacterFacetsView> =>
      CharacterFacetsViewSchema.parse(await charactersControllerFacets(params, { signal })),
    queryKey: characterKeys.facets(params),
  });
}
