import type { CharacterDeletionResult } from "@app/shared";

import { CharacterDeletionResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { charactersControllerSoftDelete } from "@/shared/api/generated/endpoints/characters/characters";

import { characterChangeEffects } from "./character-change-effects";

export function useSoftDeleteCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterId: string): Promise<CharacterDeletionResult> =>
      CharacterDeletionResultSchema.parse(
        await charactersControllerSoftDelete(characterId, { confirm: "true" }),
      ),
    onSuccess: () => {
      void characterChangeEffects.charactersChanged(queryClient, { change: "softDeleted" });
    },
  });
}
