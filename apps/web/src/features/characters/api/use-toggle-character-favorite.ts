import type { CharacterDetailsView } from "@app/shared";
import type { QueryKey } from "@tanstack/react-query";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { charactersControllerUpdateGlobal } from "@/shared/api/generated/endpoints/characters/characters";

import type { BookCharactersPage } from "./use-book-characters";

import { characterKeys } from "./character-keys";

type ToggleFavoriteContext = {
  previousPages: [QueryKey, BookCharactersPage | undefined][];
};

type ToggleFavoriteVariables = {
  characterId: string;
  isFavorite: boolean;
};

export function useToggleCharacterFavorite(bookId: string) {
  const queryClient = useQueryClient();
  const rosterScope = { queryKey: characterKeys.bookRosterScope(bookId) };

  return useMutation({
    mutationFn: async ({
      characterId,
      isFavorite,
    }: ToggleFavoriteVariables): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(
        await charactersControllerUpdateGlobal(characterId, { isFavorite }),
      ),
    onError: (_error, _variables, context: ToggleFavoriteContext | undefined) => {
      if (context === undefined) return;
      for (const [queryKey, page] of context.previousPages) {
        queryClient.setQueryData(queryKey, page);
      }
    },
    onMutate: async ({ characterId, isFavorite }): Promise<ToggleFavoriteContext> => {
      await queryClient.cancelQueries(rosterScope);
      const previousPages = queryClient.getQueriesData<BookCharactersPage>(rosterScope);

      queryClient.setQueriesData<BookCharactersPage>(rosterScope, (page) =>
        page === undefined ? page : withFavorite(page, characterId, isFavorite),
      );

      return { previousPages };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}

function withFavorite(
  page: BookCharactersPage,
  characterId: string,
  isFavorite: boolean,
): BookCharactersPage {
  return {
    ...page,
    items: page.items.map((item) =>
      item.characterId === characterId ? { ...item, isFavorite } : item,
    ),
  };
}
