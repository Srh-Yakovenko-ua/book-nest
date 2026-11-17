import type { QueryClient } from "@tanstack/react-query";

import { HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";

import { type CharacterFactsScope, characterKeys } from "./character-keys";

export function isCharacterFactGone(error: unknown): boolean {
  return isApiErrorStatus(error, HTTP_STATUS.notFound);
}

export async function refreshCharacterFacts(
  queryClient: QueryClient,
  scope: CharacterFactsScope,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: characterKeys.factsScope(scope) }),
    queryClient.invalidateQueries({ queryKey: characterKeys.deletionPreview(scope.characterId) }),
  ]);
}

export async function refreshCharacterFactsWhenGone({
  error,
  queryClient,
  scope,
}: {
  error: unknown;
  queryClient: QueryClient;
  scope: CharacterFactsScope;
}): Promise<void> {
  if (!isCharacterFactGone(error)) return;
  await Promise.all([
    refreshCharacterFacts(queryClient, scope),
    queryClient.invalidateQueries({ queryKey: characterKeys.detailsScope(scope.characterId) }),
  ]);
}
