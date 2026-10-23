import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { bookCharactersControllerUnlink } from "@/shared/api/generated/endpoints/characters/characters";

import { invalidateCharacterIdentityViews } from "./character-identity-sync";
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
      invalidateCharacterIdentityViews(queryClient);
      void queryClient.invalidateQueries({ queryKey: bookKeys.chapters(bookId) });
    },
  });
}
