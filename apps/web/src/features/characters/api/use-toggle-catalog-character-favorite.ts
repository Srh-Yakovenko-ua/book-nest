import type { CharacterDetailsView } from "@app/shared";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { CharacterDetailsViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { charactersControllerUpdateGlobal } from "@/shared/api/generated/endpoints/characters/characters";

import type { CharactersCatalogPage } from "./use-characters-catalog";

import { invalidateCharacterIdentityViews } from "./character-identity-sync";
import { characterKeys } from "./character-keys";

type CatalogPages = InfiniteData<CharactersCatalogPage>;

type ToggleCatalogFavoriteContext = {
  previousCatalogs: [QueryKey, CatalogPages | undefined][];
};

type ToggleCatalogFavoriteVariables = {
  characterId: string;
  isFavorite: boolean;
};

export function useToggleCatalogCharacterFavorite() {
  const queryClient = useQueryClient();
  const catalogScope = { queryKey: characterKeys.searchScope() };

  return useMutation({
    mutationFn: async ({
      characterId,
      isFavorite,
    }: ToggleCatalogFavoriteVariables): Promise<CharacterDetailsView> =>
      CharacterDetailsViewSchema.parse(
        await charactersControllerUpdateGlobal(characterId, { isFavorite }),
      ),
    onError: (_error, _variables, context: ToggleCatalogFavoriteContext | undefined) => {
      if (context === undefined) return;
      for (const [queryKey, pages] of context.previousCatalogs) {
        queryClient.setQueryData(queryKey, pages);
      }
    },
    onMutate: async ({ characterId, isFavorite }): Promise<ToggleCatalogFavoriteContext> => {
      await queryClient.cancelQueries(catalogScope);

      const previousCatalogs = queryClient.getQueriesData<CatalogPages>(catalogScope);

      queryClient.setQueriesData<CatalogPages>(catalogScope, (pages) =>
        pages === undefined
          ? pages
          : {
              ...pages,
              pages: pages.pages.map((page) => withFavorite({ characterId, isFavorite, page })),
            },
      );

      return { previousCatalogs };
    },
    onSettled: () => {
      invalidateCharacterIdentityViews(queryClient);
    },
  });
}

function withFavorite({
  characterId,
  isFavorite,
  page,
}: ToggleCatalogFavoriteVariables & { page: CharactersCatalogPage }): CharactersCatalogPage {
  return {
    ...page,
    items: page.items.map((item) => (item.id === characterId ? { ...item, isFavorite } : item)),
  };
}
