import type { QueryClient } from "@tanstack/react-query";

import { isRelationshipGone } from "../model/relationship-save-error";
import { relationshipKeys } from "./relationship-keys";

export function refreshRelationships(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: relationshipKeys.all });
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
