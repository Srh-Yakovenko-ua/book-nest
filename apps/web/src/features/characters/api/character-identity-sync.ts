import type { QueryClient } from "@tanstack/react-query";

import {
  refreshRelationshipGraphs,
  refreshRelationships,
} from "@/features/character-relationships/api/relationship-mutation-effects";

import { characterKeys } from "./character-keys";

export function invalidateCharacterFavoriteViews(
  queryClient: QueryClient,
  { characterId }: { characterId: string },
): void {
  void queryClient.invalidateQueries({ queryKey: characterKeys.searchScope() });
  void queryClient.invalidateQueries({ queryKey: characterKeys.allBookRostersScope() });
  void queryClient.invalidateQueries({ queryKey: characterKeys.allBookSummariesScope() });
  void queryClient.invalidateQueries({ queryKey: characterKeys.detailsScope(characterId) });
  void queryClient.invalidateQueries({ queryKey: characterKeys.overview() });
  void queryClient.invalidateQueries({ queryKey: characterKeys.facetsScope() });
  void refreshRelationshipGraphs(queryClient);
}

export function invalidateCharacterIdentityViews(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: characterKeys.all });
  void refreshRelationships(queryClient);
}
