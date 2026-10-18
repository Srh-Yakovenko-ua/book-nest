import { useMutation, useQueryClient } from "@tanstack/react-query";

import { characterRelationshipsControllerRemoveBookState } from "@/shared/api/generated/endpoints/character-relationships/character-relationships";

import {
  refreshRelationships,
  refreshRelationshipsWhenGone,
} from "./relationship-mutation-effects";

type RemoveRelationshipBookStateVariables = {
  bookId: string;
  relationshipId: string;
};

export function useRemoveRelationshipBookState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      relationshipId,
    }: RemoveRelationshipBookStateVariables): Promise<void> => {
      await characterRelationshipsControllerRemoveBookState(relationshipId, bookId);
    },
    onError: (error) => refreshRelationshipsWhenGone({ error, queryClient }),
    onSuccess: () => refreshRelationships(queryClient),
  });
}
