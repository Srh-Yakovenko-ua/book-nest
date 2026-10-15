import type { CharacterDetailsView, CharacterRevealFieldKey } from "@app/shared";

import { CharacterDetailsViewSchema } from "@app/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import type { CharactersControllerGetByIdParams } from "@/shared/api/generated/model";

import { charactersControllerGetById } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

type CharacterDetailsQueryArgs = {
  characterId: string;
  contextBookId?: string;
  revealFieldIds?: CharacterRevealFieldKey[];
};

type UseCharacterDetailsArgs = CharacterDetailsQueryArgs & {
  enabled?: boolean;
};

export function characterDetailsQueryOptions({
  characterId,
  contextBookId,
  revealFieldIds,
}: CharacterDetailsQueryArgs) {
  const params: CharactersControllerGetByIdParams = {
    ...(contextBookId === undefined ? {} : { contextBookId }),
    ...(revealFieldIds === undefined || revealFieldIds.length === 0 ? {} : { revealFieldIds }),
  };

  return queryOptions({
    queryFn: async (): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(await charactersControllerGetById(characterId, params)),
    queryKey: characterKeys.details(characterId, params),
    retry: false,
  });
}

export function useCharacterDetails({ enabled = true, ...args }: UseCharacterDetailsArgs) {
  return useQuery({ ...characterDetailsQueryOptions(args), enabled });
}
