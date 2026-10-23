import type { QueryClient } from "@tanstack/react-query";

import { refreshRelationships } from "@/features/character-relationships/api/relationship-mutation-effects";

import { characterKeys } from "./character-keys";

export function invalidateCharacterIdentityViews(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: characterKeys.all });
  void refreshRelationships(queryClient);
}
