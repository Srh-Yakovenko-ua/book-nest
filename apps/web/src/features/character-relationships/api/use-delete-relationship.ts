import {
  type CharacterRelationshipDeletionResultView,
  CharacterRelationshipDeletionResultViewSchema,
} from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { characterRelationshipsControllerRemove } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import {
  refreshRelationships,
  refreshRelationshipsWhenGone,
} from "./relationship-mutation-effects";

export function useDeleteRelationship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (relationshipId: string): Promise<CharacterRelationshipDeletionResultView> =>
      CharacterRelationshipDeletionResultViewSchema.parse(
        await characterRelationshipsControllerRemove(relationshipId),
      ),
    onError: (error) => refreshRelationshipsWhenGone({ error, queryClient }),
    onSuccess: () => refreshRelationships(queryClient),
  });
}
