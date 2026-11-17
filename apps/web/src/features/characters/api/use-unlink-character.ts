import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookCharactersControllerUnlink } from "@/shared/api/generated/endpoints/characters/characters";

import { characterChangeEffects } from "./character-change-effects";
import { characterKeys } from "./character-keys";

type UnlinkCharacterVariables = {
  bookId: string;
  characterId: string;
};

export function useUnlinkCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookId, characterId }: UnlinkCharacterVariables): Promise<void> => {
      await bookCharactersControllerUnlink(bookId, characterId);
    },
    onSuccess: (_result, { bookId, characterId }) => {
      queryClient.removeQueries({ queryKey: characterKeys.factsScope({ bookId, characterId }) });
      void characterChangeEffects.charactersChanged(queryClient, {
        bookId,
        change: "unlinkedFromBook",
      });
    },
  });
}
