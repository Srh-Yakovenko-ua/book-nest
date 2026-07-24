import type { CharacterDetailsView, UpdateCharacter } from "@app/shared";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { charactersControllerUpdateGlobal } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

type UpdateCharacterVariables = {
  characterId: string;
  input: UpdateCharacter;
};

export function useUpdateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      characterId,
      input,
    }: UpdateCharacterVariables): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(await charactersControllerUpdateGlobal(characterId, input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}
