import type { CharacterFactView, CreateCharacterFactInput } from "@app/shared";

import { CharacterFactViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { characterFactsControllerCreate } from "@/shared/api/generated/endpoints/characters/characters";

import type { CharacterFactsScope } from "./character-keys";

import {
  refreshCharacterFacts,
  refreshCharacterFactsWhenGone,
} from "./character-fact-mutation-effects";

type CreateCharacterFactVariables = CharacterFactsScope & {
  input: CreateCharacterFactInput;
};

export function useCreateCharacterFact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      characterId,
      input,
    }: CreateCharacterFactVariables): Promise<CharacterFactView> =>
      CharacterFactViewSchema.parse(
        await characterFactsControllerCreate(bookId, characterId, input),
      ),
    onError: (error, { bookId, characterId }) =>
      refreshCharacterFactsWhenGone({ error, queryClient, scope: { bookId, characterId } }),
    onSuccess: (_fact, { bookId, characterId }) =>
      refreshCharacterFacts(queryClient, { bookId, characterId }),
  });
}
