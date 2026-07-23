import type { CharacterDetailsView } from "@app/shared";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { charactersControllerRestore } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export function useRestoreCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterId: string): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(await charactersControllerRestore(characterId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}
