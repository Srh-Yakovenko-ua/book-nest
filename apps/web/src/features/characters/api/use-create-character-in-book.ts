import type { CharacterDetailsView, CreateCharacterInBook } from "@app/shared";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookCharactersControllerCreate } from "@/shared/api/generated/endpoints/characters/characters";

import { characterChangeEffects } from "./character-change-effects";

type CreateCharacterInBookVariables = {
  bookId: string;
  input: CreateCharacterInBook;
};

export function useCreateCharacterInBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      input,
    }: CreateCharacterInBookVariables): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(await bookCharactersControllerCreate(bookId, input)),
    onSuccess: () => {
      void characterChangeEffects.charactersChanged(queryClient, { change: "createdInBook" });
    },
  });
}
