import type { CharacterDeletionResult } from "@app/shared";

import { CharacterDeletionResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { charactersControllerSoftDelete } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

export function useSoftDeleteCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterId: string): Promise<CharacterDeletionResult> =>
      CharacterDeletionResultSchema.parse(
        await charactersControllerSoftDelete(characterId, { confirm: "true" }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}
