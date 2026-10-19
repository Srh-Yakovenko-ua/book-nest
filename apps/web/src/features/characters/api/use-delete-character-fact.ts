import { useMutation, useQueryClient } from "@tanstack/react-query";

import { characterFactsControllerRemove } from "@/shared/api/generated/endpoints/characters/characters";

import type { CharacterFactsScope } from "./character-keys";

import {
  refreshCharacterFacts,
  refreshCharacterFactsWhenGone,
} from "./character-fact-mutation-effects";

type DeleteCharacterFactVariables = CharacterFactsScope & {
  factId: string;
};

export function useDeleteCharacterFact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      characterId,
      factId,
    }: DeleteCharacterFactVariables): Promise<void> => {
      await characterFactsControllerRemove(bookId, characterId, factId);
    },
    onError: (error, { bookId, characterId }) =>
      refreshCharacterFactsWhenGone({ error, queryClient, scope: { bookId, characterId } }),
    onSuccess: (_result, { bookId, characterId }) =>
      refreshCharacterFacts(queryClient, { bookId, characterId }),
  });
}
