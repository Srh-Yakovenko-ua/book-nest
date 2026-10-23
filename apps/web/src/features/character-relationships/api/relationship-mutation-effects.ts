import type { QueryClient } from "@tanstack/react-query";

import { isRelationshipGone } from "../model/relationship-save-error";
import { relationshipKeys } from "./relationship-keys";

export function refreshRelationships(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: relationshipKeys.all });
}

export async function refreshRelationshipsAndDictionaries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    refreshRelationships(queryClient),
    queryClient.resetQueries({ queryKey: relationshipKeys.dictionaries.customTypes }),
    queryClient.resetQueries({ queryKey: relationshipKeys.dictionaries.roleSuggestions }),
  ]);
}

export async function refreshRelationshipsWhenGone({
  error,
  queryClient,
}: {
  error: unknown;
  queryClient: QueryClient;
}): Promise<void> {
  if (!isRelationshipGone(error)) return;
  await refreshRelationships(queryClient);
}

export function resetRelationshipReaderViews(queryClient: QueryClient): Promise<void> {
  return queryClient.resetQueries({ queryKey: relationshipKeys.all });
}
