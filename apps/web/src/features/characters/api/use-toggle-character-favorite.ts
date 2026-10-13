import type { CharacterDetailsView } from "@app/shared";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { charactersControllerUpdateGlobal } from "@/shared/api/generated/endpoints/characters/characters";

import type { BookCharactersPage } from "./use-book-characters";

import { characterKeys } from "./character-keys";

type ToggleFavoriteContext = {
  previousInfinitePages: [QueryKey, InfiniteData<BookCharactersPage> | undefined][];
  previousPages: [QueryKey, BookCharactersPage | undefined][];
};

type ToggleFavoriteVariables = {
  characterId: string;
  isFavorite: boolean;
};

export function useToggleCharacterFavorite(bookId: string) {
  const queryClient = useQueryClient();
  const finiteScope = { queryKey: characterKeys.bookRosterFiniteScope(bookId) };
  const infiniteScope = { queryKey: characterKeys.bookRosterInfiniteScope(bookId) };

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
      for (const [queryKey, pages] of context.previousInfinitePages) {
        queryClient.setQueryData(queryKey, pages);
      }
    },
    onMutate: async ({ characterId, isFavorite }): Promise<ToggleFavoriteContext> => {
      await queryClient.cancelQueries({ queryKey: characterKeys.bookRosterScope(bookId) });

      const previousPages = queryClient.getQueriesData<BookCharactersPage>(finiteScope);
      const previousInfinitePages =
        queryClient.getQueriesData<InfiniteData<BookCharactersPage>>(infiniteScope);

      queryClient.setQueriesData<BookCharactersPage>(finiteScope, (page) =>
        page === undefined ? page : withFavorite(page, characterId, isFavorite),
      );

      queryClient.setQueriesData<InfiniteData<BookCharactersPage>>(infiniteScope, (pages) =>
        pages === undefined
          ? pages
          : {
              ...pages,
              pages: pages.pages.map((page) => withFavorite(page, characterId, isFavorite)),
            },
      );

      return { previousInfinitePages, previousPages };
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
