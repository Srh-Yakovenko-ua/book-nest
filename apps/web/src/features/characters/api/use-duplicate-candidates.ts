import type { CharacterDuplicateCandidatesView } from "@app/shared";

import { CharacterDuplicateCandidatesViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { CharactersControllerDuplicateCandidatesParams } from "@/shared/api/generated/model";

import { charactersControllerDuplicateCandidates } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

const DUPLICATE_MIN_LENGTH = 2;

type UseDuplicateCandidatesArgs = {
  name: string;
  seriesId?: string;
};

export function useDuplicateCandidates({ name, seriesId }: UseDuplicateCandidatesArgs) {
  const trimmed = name.trim();
  const params: CharactersControllerDuplicateCandidatesParams = {
    name: trimmed,
    ...(seriesId === undefined ? {} : { seriesId }),
  };

  return useQuery({
    enabled: trimmed.length >= DUPLICATE_MIN_LENGTH,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CharacterDuplicateCandidatesView> =>
      CharacterDuplicateCandidatesViewSchema.parse(
        await charactersControllerDuplicateCandidates(params),
      ),
    queryKey: characterKeys.duplicates(params),
  });
}
