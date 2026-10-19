import type { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/http-client";

import { type CharacterFactsScope, characterKeys } from "./character-keys";

const NOT_FOUND_STATUS = 404;

export function isCharacterFactGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === NOT_FOUND_STATUS;
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
