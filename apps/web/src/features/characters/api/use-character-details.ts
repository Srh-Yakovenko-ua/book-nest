import type { CharacterDetailsView, CharacterRevealFieldKey } from "@app/shared";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import type { CharactersControllerGetByIdParams } from "@/shared/api/generated/model";

import { charactersControllerGetById } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

type UseCharacterDetailsArgs = {
  characterId: string;
  contextBookId?: string;
  revealFieldIds?: CharacterRevealFieldKey[];
};

export function useCharacterDetails({
  characterId,
  contextBookId,
  revealFieldIds,
}: UseCharacterDetailsArgs) {
  const params: CharactersControllerGetByIdParams = {
    ...(contextBookId === undefined ? {} : { contextBookId }),
    ...(revealFieldIds === undefined || revealFieldIds.length === 0 ? {} : { revealFieldIds }),
  };

  return useQuery({
    queryFn: async (): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(await charactersControllerGetById(characterId, params)),
    queryKey: characterKeys.details(characterId, params),
    retry: false,
  });
}
