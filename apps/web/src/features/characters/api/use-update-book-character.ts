import type { CharacterDetailsView, UpdateBookCharacter } from "@app/shared";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { invalidateTagAggregateQueries } from "@/features/tags/api/tags-keys";
import { bookCharactersControllerUpdateInBook } from "@/shared/api/generated/endpoints/characters/characters";

import { characterKeys } from "./character-keys";

type UpdateBookCharacterVariables = {
  bookId: string;
  characterId: string;
  input: UpdateBookCharacter;
};

export function useUpdateBookCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      characterId,
      input,
    }: UpdateBookCharacterVariables): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(
        await bookCharactersControllerUpdateInBook(bookId, characterId, input),
      ),
    onSuccess: (_character, { bookId }) => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
      void queryClient.invalidateQueries({ queryKey: bookKeys.chapters(bookId) });
      void invalidateTagAggregateQueries(queryClient);
    },
  });
}
