import type { CharacterDuplicateCandidatesView } from "@app/shared";

import { CharacterDuplicateCandidatesViewSchema } from "@app/shared";
import { queryOptions } from "@tanstack/react-query";

import type { CharactersControllerDuplicateCandidatesParams } from "@/shared/api/generated/model";

import { charactersControllerDuplicateCandidates } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

type DuplicateCandidatesArgs = {
  name: string;
  seriesId?: string;
};

export function duplicateCandidatesQueryOptions({ name, seriesId }: DuplicateCandidatesArgs) {
  const params: CharactersControllerDuplicateCandidatesParams = {
    name,
    ...(seriesId === undefined ? {} : { seriesId }),
  };

  return queryOptions({
    queryFn: async ({ signal }): Promise<CharacterDuplicateCandidatesView> =>
      CharacterDuplicateCandidatesViewSchema.parse(
        await charactersControllerDuplicateCandidates(params, { signal }),
      ),
    queryKey: characterKeys.duplicates(params),
  });
}
