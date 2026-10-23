import type { CharacterDetailsView } from "@app/shared";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { matchesAnyBookChapters } from "@/features/books/api/book-keys";
import { invalidateTagAggregateQueries } from "@/features/tags/api/tags-keys";
import { charactersControllerRestore } from "@/shared/api/generated/endpoints/characters/characters";

import { invalidateCharacterIdentityViews } from "./character-identity-sync";

export function useRestoreCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterId: string): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(await charactersControllerRestore(characterId)),
    onSuccess: () => {
      invalidateCharacterIdentityViews(queryClient);
      void queryClient.invalidateQueries({ predicate: matchesAnyBookChapters });
      void invalidateTagAggregateQueries(queryClient);
    },
  });
}
