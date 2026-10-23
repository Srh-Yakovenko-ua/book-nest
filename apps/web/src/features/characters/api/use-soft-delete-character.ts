import type { CharacterDeletionResult } from "@app/shared";

import { CharacterDeletionResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { matchesAnyBookChapters } from "@/features/books/api/book-keys";
import { invalidateTagAggregateQueries } from "@/features/tags/api/tags-keys";
import { charactersControllerSoftDelete } from "@/shared/api/generated/endpoints/characters/characters";

import { invalidateCharacterIdentityViews } from "./character-identity-sync";

export function useSoftDeleteCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterId: string): Promise<CharacterDeletionResult> =>
      CharacterDeletionResultSchema.parse(
        await charactersControllerSoftDelete(characterId, { confirm: "true" }),
      ),
    onSuccess: () => {
      invalidateCharacterIdentityViews(queryClient);
      void queryClient.invalidateQueries({ predicate: matchesAnyBookChapters });
      void invalidateTagAggregateQueries(queryClient);
    },
  });
}
