import type { CharacterFactView, UpdateCharacterFactInput } from "@app/shared";

import { CharacterFactViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { characterFactsControllerUpdate } from "@/shared/api/generated/endpoints/characters/characters";

import type { CharacterFactsScope } from "./character-keys";

import {
  refreshCharacterFacts,
  refreshCharacterFactsWhenGone,
} from "./character-fact-mutation-effects";

type UpdateCharacterFactVariables = CharacterFactsScope & {
  factId: string;
  input: UpdateCharacterFactInput;
};

export function useUpdateCharacterFact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      characterId,
      factId,
      input,
    }: UpdateCharacterFactVariables): Promise<CharacterFactView> =>
      CharacterFactViewSchema.parse(
        await characterFactsControllerUpdate(bookId, characterId, factId, input),
      ),
    onError: (error, { bookId, characterId }) =>
      refreshCharacterFactsWhenGone({ error, queryClient, scope: { bookId, characterId } }),
    onSuccess: (_fact, { bookId, characterId }) =>
      refreshCharacterFacts(queryClient, { bookId, characterId }),
  });
}
